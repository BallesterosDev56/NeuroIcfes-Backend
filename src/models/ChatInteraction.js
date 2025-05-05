const mongoose = require('mongoose');

const chatInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['system', 'user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  context: {
    currentStep: {
      type: Number,
      default: 0
    },
    socraticPromptsUsed: [{
      prompt: String,
      userResponse: String,
      timestamp: Date
    }],
    hintsGiven: [{
      hint: String,
      timestamp: Date
    }]
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'abandoned'],
    default: 'in_progress'
  },
  outcome: {
    correctAnswer: Boolean,
    timeToComplete: Number,
    hintsNeeded: Number,
    finalAnswer: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

// Add method to get conversation context
chatInteractionSchema.methods.getConversationContext = function() {
  return this.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

// Add method to add new message
chatInteractionSchema.methods.addMessage = function(role, content) {
  this.messages.push({
    role,
    content,
    timestamp: new Date()
  });
};

module.exports = mongoose.model('ChatInteraction', chatInteractionSchema); 