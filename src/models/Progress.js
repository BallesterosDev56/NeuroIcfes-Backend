const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  subjects: [{
    subject: {
      type: String,
      required: true,
      enum: ['Matemáticas', 'Lectura Crítica', 'Ciencias Naturales', 'Sociales', 'Inglés']
    },
    questionsAttempted: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
      },
      isCorrect: {
        type: Boolean,
        required: true
      },
      timeSpent: {
        type: Number, // en segundos
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    correctAnswers: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    averageTime: {
      type: Number,
      default: 0
    }
  }],
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
progressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress; 