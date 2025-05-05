const UserProgress = require('../models/UserProgress');
const Question = require('../models/Question');

class AdaptiveLearningService {
  async adjustDifficulty(userId, subject, performance) {
    try {
      const userProgress = await UserProgress.findOne({ userId });
      const subjectProgress = userProgress.subjectProgress.find(sp => sp.subject === subject);

      if (!subjectProgress) {
        return 1; // Start with difficulty 1 for new subjects
      }

      // Calculate performance metrics
      const accuracy = (subjectProgress.correctAnswers / subjectProgress.questionsAttempted) * 100;
      const currentDifficulty = subjectProgress.currentDifficulty;

      // Adjust difficulty based on performance
      let newDifficulty = currentDifficulty;
      
      if (accuracy >= 80 && currentDifficulty < 5) {
        newDifficulty = currentDifficulty + 1;
      } else if (accuracy < 60 && currentDifficulty > 1) {
        newDifficulty = currentDifficulty - 1;
      }

      // Update user progress
      subjectProgress.currentDifficulty = newDifficulty;
      await userProgress.save();

      return newDifficulty;
    } catch (error) {
      console.error('Error adjusting difficulty:', error);
      throw new Error('Failed to adjust difficulty level');
    }
  }

  async getRecommendedQuestions(userId, subject, limit = 5) {
    try {
      const userProgress = await UserProgress.findOne({ userId });
      const subjectProgress = userProgress.subjectProgress.find(sp => sp.subject === subject);
      
      if (!subjectProgress) {
        // For new subjects, start with basic questions
        return await Question.find({ 
          subject,
          difficulty: 1 
        }).limit(limit);
      }

      // Get questions at current difficulty level
      const questions = await Question.find({
        subject,
        difficulty: subjectProgress.currentDifficulty
      }).limit(limit);

      return questions;
    } catch (error) {
      console.error('Error getting recommended questions:', error);
      throw new Error('Failed to get recommended questions');
    }
  }

  async updateLearningPath(userId, subject, completed) {
    try {
      const userProgress = await UserProgress.findOne({ userId });
      const learningPath = userProgress.learningPath.find(lp => 
        lp.subject === subject && !lp.completed
      );

      if (learningPath) {
        learningPath.completed = completed;
        if (completed) {
          learningPath.dateCompleted = new Date();
        }
        await userProgress.save();
      }
    } catch (error) {
      console.error('Error updating learning path:', error);
      throw new Error('Failed to update learning path');
    }
  }

  async getSubjectRecommendations(userId) {
    try {
      const userProgress = await UserProgress.findOne({ userId });
      const recommendations = [];

      // Analyze performance across subjects
      for (const subjectProgress of userProgress.subjectProgress) {
        const accuracy = (subjectProgress.correctAnswers / subjectProgress.questionsAttempted) * 100;
        const lastAttempted = new Date(subjectProgress.lastAttempted);
        const daysSinceLastAttempt = Math.floor((new Date() - lastAttempted) / (1000 * 60 * 60 * 24));

        // Recommend subjects that need improvement or haven't been attempted recently
        if (accuracy < 70 || daysSinceLastAttempt > 3) {
          recommendations.push({
            subject: subjectProgress.subject,
            priority: accuracy < 70 ? 'high' : 'medium',
            reason: accuracy < 70 ? 'Needs improvement' : 'Needs practice'
          });
        }
      }

      // Sort recommendations by priority
      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    } catch (error) {
      console.error('Error getting subject recommendations:', error);
      throw new Error('Failed to get subject recommendations');
    }
  }
}

module.exports = new AdaptiveLearningService(); 