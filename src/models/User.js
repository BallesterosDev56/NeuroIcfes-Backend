const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define progress schema
const progressSchema = new mongoose.Schema({
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: null
  },
  subjectProgress: [{
    subject: {
      type: String,
      required: true
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    correctAnswersStreak: {
      type: Number,
      default: 0
    },
    averageAccuracy: {
      type: Number,
      default: 0
    },
    currentDifficulty: {
      type: String,
      enum: ['facil', 'medio', 'dificil'],
      default: 'facil'
    },
    questionsAnswered: [String]
  }],
  statistics: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    averageAccuracy: {
      type: Number,
      default: 0
    },
    bestSubject: {
      subject: String,
      accuracy: Number
    }
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.provider === 'email';
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  provider: {
    type: String,
    required: true,
    enum: ['email', 'google', 'facebook'],
    default: 'email'
  },
  uid: {
    type: String,
    required: true,
    unique: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  photoURL: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  grade: {
    type: String,
    enum: ['9°', '10°', '11°']
  },
  subject: {
    type: String,
    enum: ['Ciencias Naturales', 'Lectura Crítica']
  },
  hasExperience: {
    type: Boolean
  },
  preferences: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Add progress field
  progress: {
    type: progressSchema,
    default: () => ({})
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar updatedAt antes de guardar
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 