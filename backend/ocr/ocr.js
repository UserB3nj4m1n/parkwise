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
      throw new Error('Could not retrieve image dimensions.');
    }

    const halfHeight = Math.round(metadata.height * 0.5);

    processedImageBuffer = await image
      .rotate(180) 
      .flop()   
      .toBuffer();
    
    fs.writeFileSync('processed_image.jpg', processedImageBuffer);
    console.log('Processed image saved. Top half excluded.');

  } catch (sharpError) {
    console.error('Error during image pre-processing:', sharpError);
    return null;
  }

  try {
    const base64Image = processedImageBuffer.toString('base64');
    console.log('Base64 image length:', base64Image.length); // Debugovací riadok
    const apiUrl = 'https://api.platerecognizer.com/v1/plate-reader/';

    const params = {
      // Plate Recognizer používa hlavičky pre autentifikáciu a pre základné rozpoznávanie nepotrebuje tieto parametre.
      // TopN môže byť relevantné, ak sa očakáva viacero ŠPZ, ale zatiaľ berieme prvú.
    };

    const config = {
      headers: {
        'Authorization': `Token ${PLATE_RECOGNIZER_API_KEY}`
        // Odstránený 'Content-Type': 'application/json', aby Axios inferoval typ
      },
      params: {
        // Voliteľné: Zadajte krajinu, ak je to potrebné, napr. 'country': 'sk' pre Slovensko
        'regions': 'sk', // Predpokladaná krajina je Slovensko na základe predchádzajúceho kontextu, možno upraviť
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
      console.log('No license plates detected by Plate Recognizer.');
      return null;
    }

  } catch (plateRecognizerError) {
    console.error('Error during Plate Recognizer OCR:', plateRecognizerError.response ? plateRecognizerError.response.data : plateRecognizerError.message);
    return null;
  }
}

module.exports = recognizeText;
