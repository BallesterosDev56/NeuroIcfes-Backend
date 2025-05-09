const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const CloudinaryService = require('../services/cloudinaryService');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Instanciar el servicio de Cloudinary
const cloudinaryService = new CloudinaryService();

// Asegurarse de que el directorio de subidas existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ruta para subir una imagen
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ninguna imagen' });
    }

    // Subir la imagen a Cloudinary
    const result = await cloudinaryService.uploadImage(req.file.path);

    // Devolver la URL y otros datos
    res.status(200).json(result);
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ message: 'Error al subir imagen', error: error.message });
  }
});

// Ruta para eliminar una imagen
router.delete('/image/:publicId', authenticate, async (req, res) => {
  try {
    const { publicId } = req.params;
    if (!publicId) {
      return res.status(400).json({ message: 'Se requiere el ID público de la imagen' });
    }

    // Eliminar la imagen de Cloudinary
    const result = await cloudinaryService.deleteImage(publicId);

    res.status(200).json({ message: 'Imagen eliminada correctamente', result });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ message: 'Error al eliminar imagen', error: error.message });
  }
});

module.exports = router; 