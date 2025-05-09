const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const Question = require('../models/Question');

// Obtener preguntas por materia
router.get('/subject/:subject', authenticate, async (req, res) => {
  try {
    const { subject } = req.params;
    const { difficulty } = req.query;

    // Validar que la materia sea válida
    const validSubjects = ['matematicas', 'ciencias', 'sociales', 'lenguaje', 'ingles'];
    if (!validSubjects.includes(subject.toLowerCase())) {
      return res.status(400).json({ 
        message: 'Materia no válida',
        validSubjects 
      });
    }

    // Mapeo de números a strings de dificultad
    const difficultyMapping = {
      '1': 'facil',
      '2': 'medio',
      '3': 'dificil'
    };

    // Construir el query
    const query = { subject: subject.toLowerCase() };
    if (difficulty) {
      query.difficulty = difficultyMapping[difficulty] || difficulty;
    }

    // Buscar preguntas
    const questions = await Question.find(query)
      .select('-__v')
      .sort({ difficulty: 1 })
      .limit(10);

    if (!questions || questions.length === 0) {
      return res.status(404).json({ 
        message: 'No se encontraron preguntas para esta materia y dificultad',
        subject,
        difficulty: query.difficulty
      });
    }

    res.json(questions);
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    res.status(500).json({ 
      message: 'Error al obtener preguntas',
      error: error.message 
    });
  }
});

// Obtener una pregunta específica
router.get('/:id', authenticate, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }
    res.json(question);
  } catch (error) {
    console.error('Error al obtener pregunta:', error);
    res.status(500).json({ message: 'Error al obtener pregunta' });
  }
});

// Crear nueva pregunta (solo admin)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    console.log('Received question data:', req.body); // Debug log
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    console.error('Error al crear pregunta:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al crear pregunta', details: error.message });
  }
});

// Crear múltiples preguntas en lote (solo admin)
router.post('/batch', authenticate, isAdmin, async (req, res) => {
  try {
    console.log('Received batch questions data:', req.body); // Debug log
    const questions = req.body;
    
    if (!Array.isArray(questions)) {
      return res.status(400).json({ message: 'El body debe ser un array de preguntas' });
    }

    const savedQuestions = await Question.insertMany(questions);
    res.status(201).json(savedQuestions);
  } catch (error) {
    console.error('Error al crear preguntas en lote:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al crear preguntas en lote', details: error.message });
  }
});

// Actualizar pregunta (solo admin)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    console.log('Updating question with data:', req.body); // Debug log
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }
    res.json(question);
  } catch (error) {
    console.error('Error al actualizar pregunta:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al actualizar pregunta', details: error.message });
  }
});

// Eliminar pregunta (solo admin)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    console.log('Deleting question:', req.params.id); // Debug log
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada' });
    }
    res.json({ message: 'Pregunta eliminada exitosamente', questionId: req.params.id });
  } catch (error) {
    console.error('Error al eliminar pregunta:', error);
    res.status(500).json({ message: 'Error al eliminar pregunta', details: error.message });
  }
});

// Obtener preguntas por dificultad
router.get('/difficulty/:difficulty', authenticate, async (req, res) => {
  try {
    const { difficulty } = req.params;
    const questions = await Question.find({ difficulty });
    res.json(questions);
  } catch (error) {
    console.error('Error al obtener preguntas por dificultad:', error);
    res.status(500).json({ message: 'Error al obtener preguntas' });
  }
});

// Obtener preguntas aleatorias
router.get('/random/:count', authenticate, async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 5;
    const questions = await Question.aggregate([
      { $sample: { size: count } }
    ]);
    res.json(questions);
  } catch (error) {
    console.error('Error al obtener preguntas aleatorias:', error);
    res.status(500).json({ message: 'Error al obtener preguntas' });
  }
});

module.exports = router; 