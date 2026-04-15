const sharp = require('sharp');
const fs = require('fs');
const axios = require('axios');

const PLATE_RECOGNIZER_API_KEY = process.env.PLATE_RECOGNIZER_API_KEY; 

async function recognizeText(imagePath) {
  let processedImageBuffer;

  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Nepodarilo sa získať rozmery obrazka.');
    }

    const halfHeight = Math.round(metadata.height * 0.5);

    processedImageBuffer = await image
      .rotate(180) 
      .flop()   
      .toBuffer();
    
    fs.writeFileSync('processed_image.jpg', processedImageBuffer);
    console.log('Spracovany obrazok ulozeny.');

  } catch (sharpError) {
    console.error('Chyba pri priprave obrazka:', sharpError);
    return null;
  }

  try {
    const base64Image = processedImageBuffer.toString('base64');
    console.log('Base64 dlzka obrazka:', base64Image.length);
    const apiUrl = 'https://api.platerecognizer.com/v1/plate-reader/';

    const config = {
      headers: {
        'Authorization': `Token ${PLATE_RECOGNIZER_API_KEY}`
      },
      params: {
        'regions': 'sk',
        'topn': 1
      }
    };

    const data = {
      upload: base64Image
    };

    const response = await axios.post(apiUrl, data, config);

    if (response.data && response.data.results && response.data.results.length > 0) {
      const plate = response.data.results[0].plate;
      const processedText = plate.replace(/\s/g, '').substring(0, 7).toUpperCase();
      return processedText;
    } else {
      console.log('Ziadna SPZ nebola rozpoznana.');
      return null;
    }

  } catch (plateRecognizerError) {
    console.error('Chyba v rozpoznavani OCR:', plateRecognizerError.response ? plateRecognizerError.response.data : plateRecognizerError.message);
    return null;
  }
}

module.exports = recognizeText;
