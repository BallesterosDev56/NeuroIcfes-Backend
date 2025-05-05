const express = require('express');
const router = express.Router();
const UserProgress = require('../models/UserProgress');
const adaptiveLearningService = require('../services/adaptiveLearningService');

// Get user progress
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      return res.status(404).json({ message: 'User progress not found' });
    }

    res.json(userProgress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subject-specific progress
router.get('/:userId/subject/:subject', async (req, res) => {
  try {
    const { userId, subject } = req.params;
    const userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      return res.status(404).json({ message: 'User progress not found' });
    }

    const subjectProgress = userProgress.subjectProgress.find(
      sp => sp.subject === subject
    );

    if (!subjectProgress) {
      return res.status(404).json({ message: 'Subject progress not found' });
    }

    res.json(subjectProgress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get learning recommendations
router.get('/:userId/recommendations', async (req, res) => {
  try {
    const { userId } = req.params;
    const recommendations = await adaptiveLearningService.getSubjectRecommendations(userId);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update learning path
router.post('/:userId/learning-path', async (req, res) => {
  try {
    const { userId } = req.params;
    const { subject, completed } = req.body;

    await adaptiveLearningService.updateLearningPath(userId, subject, completed);
    res.json({ message: 'Learning path updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get session history
router.get('/:userId/sessions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, subject } = req.query;

    const userProgress = await UserProgress.findOne({ userId });
    if (!userProgress) {
      return res.status(404).json({ message: 'User progress not found' });
    }

    let sessions = userProgress.sessionHistory;
    if (subject) {
      sessions = sessions.filter(session => session.subject === subject);
    }

    sessions.sort((a, b) => b.date - a.date);
    sessions = sessions.slice(0, parseInt(limit));

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get performance analytics
router.get('/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      return res.status(404).json({ message: 'User progress not found' });
    }

    const analytics = {
      overall: {
        totalQuestions: userProgress.subjectProgress.reduce(
          (sum, sp) => sum + sp.questionsAttempted, 0
        ),
        totalCorrect: userProgress.subjectProgress.reduce(
          (sum, sp) => sum + sp.correctAnswers, 0
        ),
        currentStreak: userProgress.currentStreak,
        longestStreak: userProgress.longestStreak
      },
      bySubject: userProgress.subjectProgress.map(sp => ({
        subject: sp.subject,
        questionsAttempted: sp.questionsAttempted,
        correctAnswers: sp.correctAnswers,
        accuracy: sp.questionsAttempted > 0 
          ? (sp.correctAnswers / sp.questionsAttempted) * 100 
          : 0,
        currentDifficulty: sp.currentDifficulty,
        lastAttempted: sp.lastAttempted
      }))
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 