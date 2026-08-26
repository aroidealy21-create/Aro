const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MAX_WIDTH = 900;
const JPEG_QUALITY = 82;
// En dessous de cette taille, une photo est deja assez legere : pas la peine de la retoucher.
const SKIP_IF_SMALLER_THAN = 220 * 1024;

async function optimizeBuffer(buffer) {
  return sharp(buffer)
    .rotate() // respecte l'orientation EXIF (photo prise verticalement au telephone/tablette)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

// Compresse toutes les photos deja presentes dans le dossier (utile pour les photos
// importees avant la mise a jour). Tourne en arriere-plan, ne bloque jamais le demarrage
// de l'application, et n'echoue jamais bruyamment (une photo illisible est juste ignoree).
async function optimizeExistingPhotos(photosDir) {
  let files;
  try {
    files = fs.readdirSync(photosDir);
  } catch (err) {
    return;
  }

  for (const file of files) {
    const fullPath = path.join(photosDir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || stat.size < SKIP_IF_SMALLER_THAN) continue;

      const original = fs.readFileSync(fullPath);
      const optimized = await optimizeBuffer(original);
      if (optimized.length < original.length) {
        fs.writeFileSync(fullPath, optimized);
      }
    } catch (err) {
      // Fichier corrompu/non-image : on l'ignore et on continue avec les suivants.
      continue;
    }
    // Laisse la main entre chaque photo pour ne jamais saturer le CPU pendant l'usage normal.
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

module.exports = { optimizeBuffer, optimizeExistingPhotos, MAX_WIDTH, JPEG_QUALITY };
