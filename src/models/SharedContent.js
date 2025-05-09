const mongoose = require('mongoose');

const sharedContentSchema = new mongoose.Schema({
  contentType: {
    type: String,
    enum: ['text', 'image', 'graph', 'mixed'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  textContent: {
    type: String,
    trim: true
  },
  mediaUrl: {
    type: String
  },
  imageData: {
    public_id: String,
    format: String,
    width: Number,
    height: Number
  },
  imageDescription: {
    type: String,
    trim: true
  },
  imageElements: [{
    elementId: Number,
    description: String,
    coordinates: String
  }],
  subject: {
    type: String,
    required: true,
    enum: ['matematicas', 'ciencias', 'sociales', 'lenguaje', 'ingles'],
    lowercase: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['facil', 'medio', 'dificil'],
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar updatedAt antes de guardar
sharedContentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const SharedContent = mongoose.model('SharedContent', sharedContentSchema);
module.exports = SharedContent; 