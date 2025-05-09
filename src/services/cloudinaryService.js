const cloudinary = require('../config/cloudinary');
const fs = require('fs');

/**
 * Servicio para manejar la subida de imágenes a Cloudinary
 */
class CloudinaryService {
  /**
   * Sube una imagen a Cloudinary
   * @param {string} imagePath - Ruta del archivo en el servidor
   * @returns {Promise<Object>} - Información de la imagen subida
   */
  async uploadImage(imagePath) {
    try {
      // Subir la imagen a Cloudinary
      const result = await cloudinary.uploader.upload(imagePath, {
        folder: 'neuroicfes',
        resource_type: 'image'
      });

      // Eliminar el archivo temporal después de subirlo
      fs.unlinkSync(imagePath);

      return {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      // Si hay un error, intentar eliminar el archivo temporal
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (cleanupError) {
        console.error('Error al eliminar archivo temporal:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   * @param {string} publicId - ID público de la imagen
   * @returns {Promise<Object>} - Resultado de la eliminación
   */
  async deleteImage(publicId) {
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CloudinaryService; 