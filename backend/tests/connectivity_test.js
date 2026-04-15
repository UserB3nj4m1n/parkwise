const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Konfigurácia
const API_URL = 'http://localhost:3000/api/check-reservation';
const IMAGE_PATH = path.join(__dirname, 'spztest.jpg');

async function simulateESP32() {
    console.log('--- ESP32 Simulátor Pripojenia ---');

    try {
        // Kontrola, či existuje testovací obrázok
        if (!fs.existsSync(IMAGE_PATH)) {
            console.error(`Chyba: Súbor ${IMAGE_PATH} nebol nájdený.`);
            return;
        }

        const imageData = fs.readFileSync(IMAGE_PATH);
        console.log(`Načítaný obrázok: ${path.basename(IMAGE_PATH)} (${imageData.length} bajtov)`);

        console.log(`Odosielam POST požiadavku na ${API_URL}...`);

        const response = await axios.post(API_URL, imageData, {
            headers: {
                'Content-Type': 'image/png' // Backend akceptuje */* vďaka bodyParser.raw
            }
        });

        console.log('Úspech! Odpoveď servera:', response.data);

    } catch (error) {
        if (error.response) {
            // Server odpovedal s chybovým kódom (napr. 404 ak ŠPZ neexistuje)
            console.log(`Server vrátil status ${error.response.status}:`, error.response.data);
        } else if (error.request) {
            // Požiadavka bola odoslaná, ale neprišla odpoveď (server asi nebeží)
            console.error('Chyba: Server neodpovedá. Uistite sa, že server.js beží na porte 3000.');
        } else {
            console.error('Nastala neočakávaná chyba:', error.message);
        }
    }
}

// Spustenie testu
simulateESP32();
