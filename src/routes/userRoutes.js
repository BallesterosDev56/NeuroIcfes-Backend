const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// Create user profile
router.post('/', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, provider } = req.body;
    
    // Validar campos requeridos
    if (!uid || !email || !displayName || !provider) {
      return res.status(400).json({ 
        message: 'Faltan campos requeridos',
        required: ['uid', 'email', 'displayName', 'provider']
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'El usuario ya existe',
        userId: existingUser._id
      });
    }

    // Check if email is already in use
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        message: 'El correo electrónico ya está en uso',
        userId: existingEmail._id
      });
    }

    const user = new User({
      uid,
      email,
      displayName,
      photoURL,
      provider,
      lastLogin: new Date(),
      isEmailVerified: provider !== 'email' // Si es Google, el email ya está verificado
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      message: 'Error al crear el perfil de usuario',
      error: error.message 
    });
  }
});

// Get user profile
router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Error al obtener el perfil de usuario' });
  }
});

// Update user profile
router.put('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Preparar los datos actualizados
    const updateData = { ...req.body };

    // Convertir hasExperience a booleano si existe
    if ('hasExperience' in updateData) {
      updateData.hasExperience = Boolean(updateData.hasExperience);
    }

    // Actualizar campos del usuario
    Object.keys(updateData).forEach(key => {
      if (key !== 'uid' && key !== 'email') { // Prevent updating uid and email
        user[key] = updateData[key];
      }
    });

    user.lastLogin = new Date();
    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al actualizar el perfil de usuario' });
  }
});

// Get all users (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const users = await User.find({}, '-password'); // Exclude password field
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

module.exports = router; 