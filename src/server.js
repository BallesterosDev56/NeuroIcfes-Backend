const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createAdminUser } = require('./scripts/seedAdmin');
const config = require('./config');

// Importar rutas
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const openaiRoutes = require('./routes/openai');
const sharedContentRoutes = require('./routes/sharedContent');
const progressRoutes = require('./routes/progress');

// Importar servicios
const ProgressService = require('./services/progressService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(config.MONGODB_URI)
  .then(async () => {
    console.log('Conectado a MongoDB');
    
    // Intentar crear el usuario admin si no existe
    try {
      await createAdminUser();
    } catch (error) {
      console.error('Error al verificar/crear usuario admin:', error);
    }
  })
  .catch((error) => {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1);
  });

// Configurar servicios
const progressService = new ProgressService();
app.set('progressService', progressService);

// Rutas
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', questionRoutes);
app.use('/api/chat/openai', openaiRoutes);
app.use('/api/shared-content', sharedContentRoutes);
app.use('/api/progress', progressRoutes);

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
}); 