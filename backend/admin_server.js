const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;
const HOST = '127.0.0.1';

const dbPath = path.resolve(__dirname, './database.db');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json());

app.use(express.static(path.resolve(__dirname, '../admin')));
app.use(express.static(path.resolve(__dirname, '../docs')));

// --- API Endpointy ---

// Proxy endpoint na otvorenie závory (aby sme nemuseli otvárať port 3000 zvonku)
app.get('/admin/open-barrier', async (req, res) => {
    try {
        const response = await axios.get('http://127.0.0.1:3000/api/debug/open-barrier');
        res.json(response.data);
    } catch (error) {
        console.error('Chyba pri komunikácii s hlavným serverom:', error.message);
        res.status(500).json({ error: 'Nepodarilo sa spojiť s hlavným serverom na porte 3000.' });
    }
});

app.get('/admin/bookings', (req, res) => {
    db.all("SELECT id, slot_id, license_plate, email, booking_date, start_time, end_time, total_price, status FROM bookings ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/admin/slots', (req, res) => {
    db.all("SELECT * FROM parking_slots ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/admin/bookings/:id', (req, res) => {
    const { email, license_plate } = req.body;
    if (!email || !license_plate) return res.status(400).json({ error: 'Email a EČV sú povinné.' });
    db.run("UPDATE bookings SET email = ?, license_plate = ? WHERE id = ?", [email, license_plate, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Rezervácia nenájdená.' });
        res.json({ message: `Rezervácia #${req.params.id} bola úspešne upravená.` });
    });
});

app.put('/admin/bookings/:id/status', (req, res) => {
    const { newStatus } = req.body;
    if (!['confirmed', 'cancelled'].includes(newStatus)) return res.status(400).json({ error: 'Neplatný stav.' });
    db.get("SELECT slot_id FROM bookings WHERE id = ?", [req.params.id], (err, booking) => {
        if (err || !booking) return res.status(404).json({ error: 'Rezervácia nenájdená.' });
        db.run("UPDATE bookings SET status = ? WHERE id = ?", [newStatus, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newSlotStatus = (newStatus === 'cancelled') ? 'available' : 'reserved';
            db.run("UPDATE parking_slots SET status = ? WHERE id = ?", [newSlotStatus, booking.slot_id], (err) => {
                if (err) return res.status(500).json({ error: 'Stav rezervácie bol zmenený, ale nepodarilo sa upraviť stav miesta.' });
                res.json({ message: `Stav rezervácie bol zmenený.` });
            });
        });
    });
});

app.delete('/admin/bookings/:id', (req, res) => {
    db.get("SELECT slot_id, status FROM bookings WHERE id = ?", [req.params.id], (err, booking) => {
        if (err) return res.status(500).json({ error: 'Chyba pri hľadaní rezervácie.' });
        db.run("DELETE FROM bookings WHERE id = ?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (booking && booking.status === 'confirmed') {
                db.run("UPDATE parking_slots SET status = 'available' WHERE id = ?", [booking.slot_id]);
            }
            res.json({ message: `Rezervácia bola odstránená.` });
        });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../admin/index.html'));
});

app.listen(PORT, HOST, () => {
    console.log(`Admin server beží na http://${HOST}:${PORT}`);
});
