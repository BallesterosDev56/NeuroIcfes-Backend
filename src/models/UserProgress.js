const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subjectProgress: [{
    subject: {
      type: String,
      enum: ['matematicas', 'ciencias', 'sociales', 'lenguaje', 'ingles']
    },
    currentDifficulty: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    },
    questionsAttempted: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    lastAttempted: Date
  }],
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActiveDate: {
    type: Date,
    default: Date.now
  },
  sessionHistory: [{
    date: Date,
    questionsAttempted: Number,
    correctAnswers: Number,
    timeSpent: Number,
    subject: String
  }],
  learningPath: [{
    subject: String,
    difficulty: Number,
    completed: Boolean,
    dateCompleted: Date
  }]
});

// Calculate accuracy percentage
userProgressSchema.methods.getAccuracy = function(subject) {
  const subjectData = this.subjectProgress.find(sp => sp.subject === subject);
  if (!subjectData || subjectData.questionsAttempted === 0) return 0;
  return (subjectData.correctAnswers / subjectData.questionsAttempted) * 100;
};

// Update streak
userProgressSchema.methods.updateStreak = function() {
  const today = new Date();
  const lastActive = new Date(this.lastActiveDate);
  const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    this.currentStreak += 1;
    if (this.currentStreak > this.longestStreak) {
      this.longestStreak = this.currentStreak;
    }
  } else if (diffDays > 1) {
    this.currentStreak = 1;
  }
  
  this.lastActiveDate = today;
};

module.exports = mongoose.model('UserProgress', userProgressSchema); 