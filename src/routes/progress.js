const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * Get user progress
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const progressService = req.app.get('progressService');
    
    const progress = await progressService.getUserProgress(userId);
    res.json(progress);
  } catch (error) {
    console.error('Error getting user progress:', error);
    res.status(500).json({ message: 'Error getting progress', error: error.message });
  }
});

/**
 * Reset user progress (clear answered questions)
 */
router.post('/reset', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const progressService = req.app.get('progressService');
    
    const progress = await progressService.resetProgress(userId);
    res.json({
      message: 'Progress reset successfully',
      progress
    });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({ message: 'Error resetting progress', error: error.message });
  }
});

module.exports = router; 