require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../docs')));


// Skontroluje, či existuje priečinok 'uploads', a ak nie, tak ho vytvorí
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}
// --- Konfigurácia nahrávania súborov (Multer) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- Sprístupnenie priečinku 'uploads' ako statického ---
app.use('/uploads', express.static('uploads'));

const db = require('./database.js');
const { recognizeLicensePlate } = require('./services/ocrService');
const { sendBookingConfirmation } = require('./services/emailService');

let barrierCommand = 'wait'; // Táto premenná drží príkaz pre ESP32, čo má robiť so závorou

// Endpoint, kde si frontend pýta všetky parkovacie miesta
app.get('/api/slots', (req, res) => {
    db.all("SELECT * FROM parking_slots", [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({ "sprava": "úspech", "data": rows });
    });
});

// Jednoduchá kontrola správnosti EČV (Evidenčné Číslo Vozidla)
function isValidLicensePlate(plate) {
    const regex = /^[a-zA-Z0-9-]{5,8}$/;
    return regex.test(plate);
}

// Koncový bod pre ESP32, kde pošle fotku na kontrolu rezervácie
app.post('/api/check-reservation', bodyParser.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    if (!req.body || req.body.length === 0) {
        return res.status(400).json({ sprava: 'Žiadny obrázok nebol nahraný.' });
    }

    // Obrázok, ktorý prišiel z kamery, sa uloží do súboru
    const imagePath = path.join(uploadsDir, `esp32-cam-${Date.now()}.jpg`);
    fs.writeFile(imagePath, req.body, async (err) => {
        if (err) {
            console.error('Chyba pri ukladaní obrázka z kamery:', err);
            return res.status(500).json({ sprava: 'Chyba pri ukladaní obrázka.' });
        }

        console.log(`Prišla fotka z kamery na kontrolu, uložila sa do: ${imagePath}`);
        
        try {
            const licensePlate = await recognizeLicensePlate(imagePath);
            if (!licensePlate) {
                return res.status(400).json({ sprava: 'Nepodarilo sa rozpoznať EČV.' });
            }

            const today = new Date().toISOString().slice(0, 10);
            const query = "SELECT * FROM bookings WHERE license_plate = ? AND booking_date = ?";
            
            db.get(query, [licensePlate, today], (dbErr, row) => {
                if (dbErr) {
                    console.error('Chyba v databáze:', dbErr.message);
                    return res.status(500).json({ sprava: 'Chyba databázy pri hľadaní rezervácie.' });
                }

                if (row) {
                    console.log(`Rezervácia pre EČV: ${licensePlate} nájdená.`);
                    barrierCommand = 'open';
                    res.status(200).json({ sprava: 'Rezervácia nájdená. Príkaz na otvorenie závory bol pripravený.' });
                } else {
                    console.log(`Dnešná rezervácia pre EČV: ${licensePlate} nebola nájdená.`);
                    res.status(404).json({ sprava: 'Žiadna rezervácia pre toto EČV na dnes nebola nájdená.' });
                }
            });
        } catch (error) {
            console.error('Nastala chyba pri kontrole rezervácie:', error);
            res.status(500).json({ sprava: 'Interná chyba servera pri kontrole rezervácie.' });
        }
    });
});

// Koncový bod, kam frontend posiela dáta z formulára na vytvorenie rezervácie
app.post('/api/bookings', (req, res) => {
    const { 
        slotId, licensePlate, email, cardholderName, cardNumber, cardExpDate, cardCvv, 
        date, startTime, endTime, price 
    } = req.body;

    if (![slotId, licensePlate, email, cardholderName, cardNumber, cardExpDate, cardCvv, date, startTime, endTime, price].every(Boolean)) {
        return res.status(400).json({ sprava: 'Všetky polia pre rezerváciu sú povinné.' });
    }
    if (!isValidLicensePlate(licensePlate)) {
        return res.status(400).json({ sprava: 'Neplatný formát EČV.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ sprava: 'Neplatný formát emailu.' });
    }

    const cancellationToken = crypto.randomBytes(16).toString('hex');
    const bookingQuery = `
        INSERT INTO bookings (
            slot_id, license_plate, email, cardholder_name, card_number, card_exp_date, card_cvv, 
            booking_date, start_time, end_time, total_price, cancellation_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        slotId, licensePlate, email, cardholderName, cardNumber, cardExpDate, cardCvv, 
        date, startTime, endTime, price, cancellationToken
    ];

    db.run(bookingQuery, params, function(err) {
        if (err) {
            console.error('Chyba pri vytváraní rezervácie:', err);
            return res.status(500).json({ sprava: 'Interná chyba servera.' });
        }
        
        const updateSlotQuery = "UPDATE parking_slots SET status = 'reserved' WHERE id = ?";
        db.run(updateSlotQuery, [slotId], function(err) {
            if (err) {
                console.error('Chyba pri zmene stavu parkovacieho miesta:', err);
                return res.status(500).json({ sprava: 'Rezervácia bola vytvorená, ale nepodarilo sa aktualizovať stav parkovacieho miesta.' });
            }

            db.get("SELECT slot_name FROM parking_slots WHERE id = ?", [slotId], (err, slot) => {
                if (err || !slot) {
                    console.error('Nepodarilo sa nájsť miesto, ku ktorému poslať e-mail.');
                } else {
                    sendBookingConfirmation({
                        email, 
                        licensePlate, 
                        booking_date: date, 
                        startTime, 
                        endTime,
                        total_price: price, 
                        cancellation_token: cancellationToken, 
                        slot_name: slot.slot_name,
                        cardholderName
                    }).catch(emailError => {
                        console.error("Nepodarilo sa odoslať potvrdzovací e-mail:", emailError);
                    });
                }
            });

            res.status(201).json({ sprava: 'Rezervácia bola úspešne vytvorená.' });
        });
    });
});


// Koncový bod na vynútené OTVORENIE závory (len na testovanie)
app.get('/api/debug/open-barrier', (req, res) => {
    barrierCommand = 'open';
    res.status(200).json({ sprava: 'Príkaz na otvorenie závory nastavený.' });
});

app.get('/api/barrier/command', (req, res) => {
    res.send(barrierCommand);
    // Vynulujem príkaz pre rampu, aby sa neotvárala stále dokola
    if (barrierCommand === 'open') {
        barrierCommand = 'wait';
    }
});

// --- Nová logika pre zrušenie rezervácie ---
const cancellationPagePath = path.join(__dirname, '../docs/cancel.html');

// Pomocná funkcia na odoslanie stránky s nahradeným obsahom
function sendCancellationPage(res, status, icon, title, text) {
    fs.readFile(cancellationPagePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Chyba pri čítaní súboru cancel.html:", err);
            return res.status(500).send("Nastala interná chyba servera.");
        }
        
        let html = data.replace('{{ICON}}', icon);
        html = html.replace('{{MESSAGE_TITLE}}', title);
        html = html.replace('{{MESSAGE_TEXT}}', text);
        
        res.status(status).send(html);
    });
}

app.get('/api/bookings/cancel/:token', (req, res) => {
    const { token } = req.params;

    db.get("SELECT * FROM bookings WHERE cancellation_token = ? AND status = 'confirmed'", [token], (err, booking) => {
        if (err) {
            sendCancellationPage(res, 500, 'error', 'Chyba', 'Nastala chyba v databáze. Skúste to prosím znova neskôr.');
            return;
        }
        if (!booking) {
            sendCancellationPage(res, 404, 'help', 'Nenájdené', 'Táto rezervácia nebola nájdená alebo už bola zrušená.');
            return;
        }

        db.serialize(() => {
            db.run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [booking.id], function(err) {
                if (err) {
                    sendCancellationPage(res, 500, 'error', 'Chyba', 'Nepodarilo sa zmeniť stav rezervácie.');
                    return;
                }
                db.run("UPDATE parking_slots SET status = 'available' WHERE id = ?", [booking.slot_id], function(err) {
                    if (err) {
                        console.error(`Nepodarilo sa uvoľniť miesto ${booking.slot_id} pre zrušenú rezerváciu ${booking.id}`);
                        sendCancellationPage(res, 500, 'error', 'Chyba', 'Rezervácia bola zrušená, ale parkovacie miesto sa nepodarilo uvoľniť. Kontaktujte podporu.');
                        return;
                    }
                    sendCancellationPage(res, 200, 'check_circle', 'Úspech', 'Vaša rezervácia bola úspešne zrušená.');
                });
            });
        });
    });
});


if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server beží na adrese http://localhost:${port}`);
    });
}

module.exports = app;