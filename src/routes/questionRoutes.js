const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const ChatInteraction = require('../models/ChatInteraction');
const UserProgress = require('../models/UserProgress');
const openaiService = require('../services/openaiService');
const adaptiveLearningService = require('../services/adaptiveLearningService');

// Get questions by subject and difficulty
router.get('/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    const { difficulty, limit = 5 } = req.query;
    
    const questions = await Question.find({
      subject,
      difficulty: difficulty || { $exists: true }
    }).limit(parseInt(limit));

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start a new question session
router.post('/:questionId/start', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const chatInteraction = new ChatInteraction({
      userId,
      questionId,
      messages: [{
        role: 'system',
        content: 'Starting new question session'
      }]
    });

    await chatInteraction.save();

    res.json({
      question,
      sessionId: chatInteraction._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit answer and get Socratic response
router.post('/:questionId/answer', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userId, answer, sessionId } = req.body;

    const question = await Question.findById(questionId);
    const chatInteraction = await ChatInteraction.findById(sessionId);
    
    if (!question || !chatInteraction) {
      return res.status(404).json({ message: 'Question or session not found' });
    }

    // Add user's answer to chat history
    chatInteraction.addMessage('user', answer);

    // Generate Socratic response
    const socraticResponse = await openaiService.generateSocraticPrompt(
      question,
      answer,
      chatInteraction.context
    );

    // Add AI response to chat history
    chatInteraction.addMessage('assistant', socraticResponse);

    // Update context
    chatInteraction.context.currentStep += 1;
    chatInteraction.context.socraticPromptsUsed.push({
      prompt: socraticResponse,
      userResponse: answer,
      timestamp: new Date()
    });

    await chatInteraction.save();

    // Update user progress
    const userProgress = await UserProgress.findOne({ userId });
    const subjectProgress = userProgress.subjectProgress.find(
      sp => sp.subject === question.subject
    );

    if (subjectProgress) {
      subjectProgress.questionsAttempted += 1;
      subjectProgress.lastAttempted = new Date();
      await userProgress.save();
    }

    res.json({
      response: socraticResponse,
      context: chatInteraction.context
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hint for current question
router.get('/:questionId/hint', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { sessionId } = req.query;

    const question = await Question.findById(questionId);
    const chatInteraction = await ChatInteraction.findById(sessionId);

    if (!question || !chatInteraction) {
      return res.status(404).json({ message: 'Question or session not found' });
    }

    const hint = await openaiService.generateHint(
      question,
      chatInteraction.context
    );

    chatInteraction.context.hintsGiven.push({
      hint,
      timestamp: new Date()
    });

    await chatInteraction.save();

    res.json({ hint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get recommended questions
router.get('/recommended/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    const { userId } = req.query;

    const questions = await adaptiveLearningService.getRecommendedQuestions(
      userId,
      subject
    );

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 