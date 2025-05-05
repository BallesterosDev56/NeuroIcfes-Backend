const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Chat = require('../models/Chat');
const { OpenAI } = require('openai');
const { OPENAI_API_KEY } = require('../config');

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Obtener historial de chat
router.get('/history', authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({ userId: req.user.uid });
    if (!chat) {
      return res.status(404).json({ message: 'Historial de chat no encontrado' });
    }
    res.json(chat.messages);
  } catch (error) {
    console.error('Error al obtener historial de chat:', error);
    res.status(500).json({ message: 'Error al obtener historial de chat' });
  }
});

// Enviar mensaje y obtener respuesta
router.post('/message', authenticate, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    // Buscar o crear chat del usuario
    let chat = await Chat.findOne({ userId: req.user.uid });
    if (!chat) {
      chat = new Chat({
        userId: req.user.uid,
        messages: []
      });
    }

    // Agregar mensaje del usuario
    chat.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Preparar el contexto para OpenAI
    const systemPrompt = `Eres un tutor socrático especializado en preparación para el examen ICFES. 
    Tu objetivo es guiar al estudiante a través de preguntas y reflexiones, no dar respuestas directas.
    Contexto actual: ${context || 'No hay contexto específico'}`;

    // Preparar mensajes para OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chat.messages.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Obtener respuesta de OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    // Agregar respuesta del AI
    chat.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    });

    // Guardar chat actualizado
    await chat.save();

    res.json({
      message: aiResponse,
      history: chat.messages
    });
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    res.status(500).json({ message: 'Error al procesar mensaje' });
  }
});

// Limpiar historial de chat
router.delete('/clear', authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({ userId: req.user.uid });
    if (chat) {
      chat.messages = [];
      await chat.save();
    }
    res.json({ message: 'Historial de chat limpiado' });
  } catch (error) {
    console.error('Error al limpiar historial:', error);
    res.status(500).json({ message: 'Error al limpiar historial' });
  }
});

module.exports = router; 