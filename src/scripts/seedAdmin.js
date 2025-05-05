const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const firebaseConfig = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig)
});

async function createAdminUser() {
  try {
    const adminEmail = 'daniel.ballesteros@teilur.ai';
    const adminPassword = 'Teilur2025@';

    // Verificar si ya existe un usuario admin en MongoDB
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    // Intentar obtener el usuario de Firebase
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(adminEmail);
      console.log('El usuario admin ya existe en Firebase');
      
      // Actualizar la contraseña en Firebase
      await admin.auth().updateUser(firebaseUser.uid, {
        password: adminPassword
      });
      console.log('Contraseña actualizada en Firebase');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Si el usuario no existe en Firebase, crearlo
        firebaseUser = await admin.auth().createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: 'Teilur',
          emailVerified: true
        });
        console.log('Usuario admin creado en Firebase');
      } else {
        throw error;
      }
    }

    // Si el usuario no existe en MongoDB, crearlo
    if (!existingAdmin) {
      // Crear hash de la contraseña para MongoDB
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Crear usuario admin en MongoDB
      const adminUser = new User({
        displayName: 'Teilur',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        provider: 'email',
        uid: firebaseUser.uid,
        isEmailVerified: true
      });

      await adminUser.save();
      console.log('Usuario admin creado exitosamente en MongoDB');
    } else {
      // Actualizar el uid en MongoDB si es necesario
      if (existingAdmin.uid !== firebaseUser.uid) {
        existingAdmin.uid = firebaseUser.uid;
        await existingAdmin.save();
        console.log('UID actualizado en MongoDB');
      }
    }
  } catch (error) {
    console.error('Error al crear/actualizar usuario admin:', error);
    throw error;
  }
}

module.exports = { createAdminUser }; 