const User = require('../models/User');
const admin = require('firebase-admin');

// Middleware para verificar el usuario
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Buscar el usuario en nuestra base de datos
    const user = await User.findOne({ uid: decodedToken.uid });
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Agregar el usuario a la request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(401).json({ message: 'Error de autenticación' });
  }
};

// Middleware para verificar rol de admin
const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
  } catch (error) {
    console.error('Error al verificar rol:', error);
    res.status(500).json({ message: 'Error al verificar permisos' });
  }
};

module.exports = {
  authenticate,
  isAdmin
}; 