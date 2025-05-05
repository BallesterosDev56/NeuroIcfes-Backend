const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    enum: ['matematicas', 'ciencias', 'sociales', 'lenguaje', 'ingles'],
    lowercase: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  difficulty: {
    type: String,
    required: true,
    enum: ['facil', 'medio', 'dificil'],
    lowercase: true
  },
  category: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  explanation: {
    type: String,
    required: true,
    trim: true
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
questionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Validación para asegurar que solo una opción es correcta
questionSchema.pre('save', function(next) {
  const correctOptions = this.options.filter(option => option.isCorrect);
  if (correctOptions.length !== 1) {
    return next(new Error('Debe haber exactamente una opción correcta'));
  }
  next();
});

// Método para validar la respuesta
questionSchema.methods.validateAnswer = function(answer) {
  const correctOption = this.options.find(option => option.isCorrect);
  return correctOption && correctOption.text === answer;
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question; 