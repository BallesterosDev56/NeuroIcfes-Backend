const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const SharedContent = require('../models/SharedContent');
const Question = require('../models/Question');

// Obtener todos los contenidos compartidos
router.get('/', authenticate, async (req, res) => {
  try {
    const { subject } = req.query;
    const query = {};
    
    if (subject) {
      query.subject = subject.toLowerCase();
    }
    
    const sharedContents = await SharedContent.find(query).sort({ createdAt: -1 });
    res.json(sharedContents);
  } catch (error) {
    console.error('Error al obtener contenidos compartidos:', error);
    res.status(500).json({ message: 'Error al obtener contenidos compartidos', error: error.message });
  }
});

// Obtener un contenido compartido específico con sus preguntas
router.get('/:id', authenticate, async (req, res) => {
  try {
    const sharedContent = await SharedContent.findById(req.params.id);
    if (!sharedContent) {
      return res.status(404).json({ message: 'Contenido compartido no encontrado' });
    }
    
    // Obtener preguntas asociadas a este contenido
    const questions = await Question.find({ 
      sharedContentId: req.params.id 
    }).sort({ position: 1 });
    
    res.json({ sharedContent, questions });
  } catch (error) {
    console.error('Error al obtener contenido compartido:', error);
    res.status(500).json({ message: 'Error al obtener contenido compartido', error: error.message });
  }
});

// Crear nuevo contenido compartido (solo admin)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const sharedContent = new SharedContent(req.body);
    await sharedContent.save();
    res.status(201).json(sharedContent);
  } catch (error) {
    console.error('Error al crear contenido compartido:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al crear contenido compartido', error: error.message });
  }
});

// Actualizar contenido compartido (solo admin)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const sharedContent = await SharedContent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!sharedContent) {
      return res.status(404).json({ message: 'Contenido compartido no encontrado' });
    }
    
    res.json(sharedContent);
  } catch (error) {
    console.error('Error al actualizar contenido compartido:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Error de validación', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ message: 'Error al actualizar contenido compartido', error: error.message });
  }
});

// Eliminar contenido compartido (solo admin)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    // Verificar si hay preguntas que dependen de este contenido
    const questionCount = await Question.countDocuments({ sharedContentId: req.params.id });
    if (questionCount > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar este contenido porque tiene preguntas asociadas',
        questionCount 
      });
    }
    
    const sharedContent = await SharedContent.findByIdAndDelete(req.params.id);
    if (!sharedContent) {
      return res.status(404).json({ message: 'Contenido compartido no encontrado' });
    }
    
    res.json({ message: 'Contenido compartido eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar contenido compartido:', error);
    res.status(500).json({ message: 'Error al eliminar contenido compartido', error: error.message });
  }
});

// Obtener todas las preguntas para un contenido compartido
router.get('/:id/questions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el contenido existe
    const sharedContent = await SharedContent.findById(id);
    if (!sharedContent) {
      return res.status(404).json({ message: 'Contenido compartido no encontrado' });
    }
    
    // Obtener preguntas asociadas
    const questions = await Question.find({ 
      sharedContentId: id 
    }).sort({ position: 1 });
    
    res.json(questions);
  } catch (error) {
    console.error('Error al obtener preguntas del contenido compartido:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

module.exports = router; 