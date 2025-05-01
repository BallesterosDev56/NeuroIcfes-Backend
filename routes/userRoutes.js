const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Create user profile
router.post('/', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, provider } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      uid,
      email,
      displayName,
      photoURL,
      provider,
      lastLogin: new Date()
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user profile' });
  }
});

// Get user profile
router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Error getting user profile' });
  }
});

// Update user profile
router.put('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Error updating user profile' });
  }
});

module.exports = router; 