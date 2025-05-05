const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Progress = require('../models/Progress');

// Obtener progreso del usuario
router.get('/', authenticate, async (req, res) => {
  try {
    const progress = await Progress.findOne({ userId: req.user.uid });
    if (!progress) {
      return res.status(404).json({ message: 'Progreso no encontrado' });
    }
    res.json(progress);
  } catch (error) {
    console.error('Error al obtener progreso:', error);
    res.status(500).json({ message: 'Error al obtener progreso' });
  }
});

// Obtener progreso por materia
router.get('/subject/:subject', authenticate, async (req, res) => {
  try {
    const progress = await Progress.findOne({
      userId: req.user.uid,
      'subjects.subject': req.params.subject
    });
    
    if (!progress) {
      return res.status(404).json({ message: 'Progreso no encontrado para esta materia' });
    }
    
    const subjectProgress = progress.subjects.find(
      sub => sub.subject === req.params.subject
    );
    
    res.json(subjectProgress);
  } catch (error) {
    console.error('Error al obtener progreso por materia:', error);
    res.status(500).json({ message: 'Error al obtener progreso' });
  }
});

// Actualizar progreso
router.post('/update', authenticate, async (req, res) => {
  try {
    const { subject, questionId, isCorrect, timeSpent } = req.body;

    let progress = await Progress.findOne({ userId: req.user.uid });
    
    if (!progress) {
      // Crear nuevo progreso si no existe
      progress = new Progress({
        userId: req.user.uid,
        subjects: [{
          subject,
          questionsAttempted: [],
          correctAnswers: 0,
          totalQuestions: 0,
          averageTime: 0
        }]
      });
    }

    // Buscar o crear la materia en el progreso
    let subjectProgress = progress.subjects.find(s => s.subject === subject);
    if (!subjectProgress) {
      subjectProgress = {
        subject,
        questionsAttempted: [],
        correctAnswers: 0,
        totalQuestions: 0,
        averageTime: 0
      };
      progress.subjects.push(subjectProgress);
    }

    // Actualizar estadísticas
    subjectProgress.questionsAttempted.push({
      questionId,
      isCorrect,
      timeSpent,
      timestamp: new Date()
    });

    subjectProgress.totalQuestions++;
    if (isCorrect) {
      subjectProgress.correctAnswers++;
    }

    // Calcular tiempo promedio
    const totalTime = subjectProgress.questionsAttempted.reduce(
      (sum, q) => sum + q.timeSpent, 0
    );
    subjectProgress.averageTime = totalTime / subjectProgress.totalQuestions;

    await progress.save();
    res.json(progress);
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    res.status(500).json({ message: 'Error al actualizar progreso' });
  }
});

// Obtener recomendaciones basadas en el progreso
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const progress = await Progress.findOne({ userId: req.user.uid });
    if (!progress) {
      return res.status(404).json({ message: 'Progreso no encontrado' });
    }

    // Analizar el progreso y generar recomendaciones
    const recommendations = progress.subjects.map(subject => ({
      subject: subject.subject,
      strength: subject.correctAnswers / subject.totalQuestions,
      needsPractice: subject.correctAnswers / subject.totalQuestions < 0.7,
      averageTime: subject.averageTime
    }));

    res.json(recommendations);
  } catch (error) {
    console.error('Error al obtener recomendaciones:', error);
    res.status(500).json({ message: 'Error al obtener recomendaciones' });
  }
});

module.exports = router; 