const User = require('../models/User');

class ProgressService {
  /**
   * Get user progress information
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - The user's progress data
   */
  async getUserProgress(userId) {
    try {
      const user = await User.findById(userId).select('progress');
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Ensure progress and answeredQuestions array exists
      if (!user.progress) {
        user.progress = {
          currentStreak: 0,
          longestStreak: 0,
          lastActivity: null,
          subjectProgress: [],
          answeredQuestions: [],
          statistics: {
            totalQuestions: 0,
            correctAnswers: 0,
            averageAccuracy: 0,
            bestSubject: null
          }
        };
      }
      
      // Ensure the answeredQuestions array exists
      if (!user.progress.answeredQuestions) {
        user.progress.answeredQuestions = [];
      }
      
      return user.progress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  /**
   * Update user progress after answering a question
   * @param {string} userId - The user ID
   * @param {Object} data - Progress data
   * @param {string} data.subject - Subject of the question
   * @param {string} data.questionId - ID of the question answered
   * @param {boolean} data.isCorrect - Whether the answer was correct
   * @param {number} data.timeSpent - Time spent on the question (in ms)
   * @returns {Promise<Object>} - The updated progress
   */
  async updateProgress(userId, data) {
    try {
      const { subject, questionId, isCorrect, timeSpent } = data;
      
      // Get current user data
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Initialize progress if it doesn't exist
      if (!user.progress) {
        user.progress = {
          currentStreak: 0,
          longestStreak: 0,
          lastActivity: new Date(),
          subjectProgress: [],
          answeredQuestions: [],
          statistics: {
            totalQuestions: 0,
            correctAnswers: 0,
            averageAccuracy: 0,
            bestSubject: null
          }
        };
      }
      
      // Ensure the answeredQuestions array exists
      if (!user.progress.answeredQuestions) {
        user.progress.answeredQuestions = [];
      }

      // Update last activity date and check streak
      const today = new Date();
      const lastActivityDate = user.progress.lastActivity ? new Date(user.progress.lastActivity) : null;
      
      // Convert dates to their day representations for comparison (ignoring time)
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const lastDay = lastActivityDate ? 
        new Date(lastActivityDate.getFullYear(), lastActivityDate.getMonth(), lastActivityDate.getDate()) :
        null;
      
      // Check if the last activity was yesterday to maintain the streak
      const dayDifference = lastDay ? 
        Math.floor((todayDay - lastDay) / (1000 * 60 * 60 * 24)) : 
        null;
        
      if (dayDifference === 1) {
        // Last activity was yesterday, increase streak
        user.progress.currentStreak++;
      } else if (dayDifference > 1 || dayDifference === null) {
        // Reset streak if more than a day has passed
        user.progress.currentStreak = 1;
      }
      // If same day, don't update streak
      
      // Update longest streak if needed
      if (user.progress.currentStreak > user.progress.longestStreak) {
        user.progress.longestStreak = user.progress.currentStreak;
      }
      
      // Update last activity
      user.progress.lastActivity = today;

      // Find or create subject progress
      let subjectProgress = user.progress.subjectProgress.find(sp => sp.subject === subject);
      if (!subjectProgress) {
        subjectProgress = {
          subject,
          totalQuestions: 0,
          correctAnswers: 0,
          correctAnswersStreak: 0,
          averageAccuracy: 0,
          currentDifficulty: 'facil',
          questionsAnswered: []
        };
        user.progress.subjectProgress.push(subjectProgress);
      }

      // Update subject progress
      subjectProgress.totalQuestions++;
      if (isCorrect) {
        subjectProgress.correctAnswers++;
        subjectProgress.correctAnswersStreak++;
      } else {
        subjectProgress.correctAnswersStreak = 0;
      }
      
      // Add question to answered list (avoid duplicates)
      if (!subjectProgress.questionsAnswered.includes(questionId.toString())) {
        subjectProgress.questionsAnswered.push(questionId.toString());
      }
      
      // Add to global answered questions list with metadata
      const answeredQuestionEntry = {
        questionId: questionId.toString(),
        subject,
        isCorrect,
        answeredAt: new Date(),
        timeSpent: timeSpent || 0
      };
      
      // Check if already answered (replace with new data if exists)
      const existingIndex = user.progress.answeredQuestions.findIndex(
        q => q.questionId === questionId.toString()
      );
      
      if (existingIndex >= 0) {
        user.progress.answeredQuestions[existingIndex] = answeredQuestionEntry;
      } else {
        user.progress.answeredQuestions.push(answeredQuestionEntry);
      }
      
      // Calculate new average accuracy
      subjectProgress.averageAccuracy = (subjectProgress.correctAnswers / subjectProgress.totalQuestions) * 100;

      // Update difficulty based on streak
      if (subjectProgress.correctAnswersStreak >= 3) {
        // Try to increase difficulty
        if (subjectProgress.currentDifficulty === 'facil') {
          subjectProgress.currentDifficulty = 'medio';
          subjectProgress.correctAnswersStreak = 0; // Reset streak after increasing difficulty
        } else if (subjectProgress.currentDifficulty === 'medio' && subjectProgress.correctAnswersStreak >= 5) {
          subjectProgress.currentDifficulty = 'dificil';
          subjectProgress.correctAnswersStreak = 0; // Reset streak after increasing difficulty
        }
      }

      // Update global statistics
      user.progress.statistics.totalQuestions++;
      if (isCorrect) {
        user.progress.statistics.correctAnswers++;
      }
      user.progress.statistics.averageAccuracy = 
        (user.progress.statistics.correctAnswers / user.progress.statistics.totalQuestions) * 100;

      // Find best subject
      if (user.progress.subjectProgress.length > 0) {
        const bestSubject = user.progress.subjectProgress.reduce((best, current) => {
          return (current.averageAccuracy > best.averageAccuracy) ? current : best;
        });
        
        user.progress.statistics.bestSubject = {
          subject: bestSubject.subject,
          accuracy: bestSubject.averageAccuracy
        };
      }

      // Save user data
      await user.save();
      return user.progress;
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  /**
   * Reset user's answered questions
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - The updated progress data
   */
  async resetProgress(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      if (user.progress) {
        // Clear answered questions
        user.progress.answeredQuestions = [];
        
        // Reset question lists in subject progress
        if (user.progress.subjectProgress && user.progress.subjectProgress.length > 0) {
          user.progress.subjectProgress.forEach(subject => {
            subject.questionsAnswered = [];
          });
        }
        
        // Save user data
        await user.save();
      }
      
      return user.progress;
    } catch (error) {
      console.error('Error resetting progress:', error);
      throw error;
    }
  }
}

module.exports = ProgressService; 