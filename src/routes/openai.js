const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Question = require('../models/Question');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store ongoing conversations
const conversations = new Map();

/**
 * Start a new OpenAI chat session
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    const { subject } = req.body;
    const userId = req.user.id;
    
    if (!subject) {
      return res.status(400).json({ message: 'Se requiere una materia válida' });
    }

    // Get user progress to determine difficulty
    const userProgress = await req.app.get('progressService').getUserProgress(userId);
    const difficulty = userProgress?.subjectProgress?.find(sp => sp.subject === subject)?.currentDifficulty || 'facil';

    // Get questions for this subject and difficulty
    const questions = await Question.find({ 
      subject: subject.toLowerCase(),
      difficulty: difficulty.toLowerCase()
    }).limit(10);

    if (!questions || questions.length === 0) {
      return res.status(404).json({ 
        message: 'No hay preguntas disponibles para esta materia y dificultad',
        noQuestionsAvailable: true
      });
    }

    // Select the first question
    const question = questions[0];

    // Initialize conversation with system message and select a question
    const initialMessages = [
      {
        role: 'system',
        content: `Eres un tutor socrático enfocado en ${subject}. 
                  Tu objetivo es guiar al estudiante a través del método socrático para que descubra la respuesta por sí mismo.
                  No reveles la respuesta directamente, sino que haz preguntas para que el estudiante pueda llegar a la respuesta correcta.
                  Eres un experto en promover el pensamiento crítico.
                  La pregunta actual es: "${question.questionText}".
                  Las opciones son: ${question.options.map(opt => `"${opt.text}"`).join(', ')}.
                  La respuesta correcta es: "${question.options.find(opt => opt.isCorrect).text}".
                  La explicación es: "${question.explanation}".
                  Comienza saludando al estudiante y presentando la pregunta actual. Luego, inicia el diálogo socrático.
                  NO DES LA RESPUESTA CORRECTA DIRECTAMENTE.`
      }
    ];

    // Create conversation session
    const session = {
      messages: initialMessages,
      currentQuestion: question,
      subject,
      difficulty,
      interests: ['General'],
      isCorrect: false,
      userId
    };

    // Generate initial AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: initialMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = {
      role: 'assistant',
      content: completion.choices[0].message.content
    };

    // Add AI message to conversation history
    session.messages.push(assistantMessage);

    // Store conversation in memory with user ID as identifier
    conversations.set(userId, session);

    // Format chat history for frontend (excluding system message)
    const chatHistory = [assistantMessage];

    res.json({
      chatHistory,
      question,
      subject,
      difficulty
    });

  } catch (error) {
    console.error('Error starting OpenAI chat:', error);
    res.status(500).json({ message: 'Error en el servidor al iniciar el chat', error: error.message });
  }
});

/**
 * Send a message to OpenAI in an ongoing conversation
 */
router.post('/message', authenticate, async (req, res) => {
  try {
    const { message, timeSpent } = req.body;
    const userId = req.user.id;

    // Check if conversation exists
    if (!conversations.has(userId)) {
      return res.status(404).json({ message: 'No hay una conversación activa' });
    }

    const session = conversations.get(userId);
    const userMessage = { role: 'user', content: message };
    
    // Add user message to conversation
    session.messages.push(userMessage);

    // Analyze if user's answer is correct
    const checkIfCorrect = await analyzeIfCorrect(session.messages, session.currentQuestion);
    
    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = {
      role: 'assistant',
      content: completion.choices[0].message.content
    };

    // Add AI message to conversation
    session.messages.push(assistantMessage);
    
    // Update the session
    session.isCorrect = checkIfCorrect.isCorrect;
    conversations.set(userId, session);

    // If answer is correct, update user progress
    if (checkIfCorrect.isCorrect) {
      await req.app.get('progressService').updateProgress(userId, {
        subject: session.subject,
        questionId: session.currentQuestion._id,
        isCorrect: true,
        timeSpent: timeSpent || 0
      });
    }

    // Format chat history for frontend (excluding system message)
    const chatHistory = session.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    res.json({
      chatHistory,
      isCorrect: checkIfCorrect.isCorrect,
      explanation: checkIfCorrect.isCorrect ? session.currentQuestion.explanation : null
    });

  } catch (error) {
    console.error('Error sending message to OpenAI:', error);
    res.status(500).json({ message: 'Error en el servidor al enviar mensaje', error: error.message });
  }
});

/**
 * Explicitly check if the answer is correct
 */
router.post('/check-answer', authenticate, async (req, res) => {
  try {
    const { answer } = req.body;
    const userId = req.user.id;

    // Check if conversation exists
    if (!conversations.has(userId)) {
      return res.status(404).json({ message: 'No hay una conversación activa' });
    }

    const session = conversations.get(userId);
    const correctOption = session.currentQuestion.options.find(opt => opt.isCorrect);
    
    // Compare answer directly
    const isCorrect = correctOption && 
                     (correctOption.text.toLowerCase() === answer.toLowerCase() ||
                      answer.toLowerCase().includes(correctOption.text.toLowerCase()));
    
    // If answer is correct, update state
    if (isCorrect) {
      session.isCorrect = true;
      conversations.set(userId, session);
      
      // Create system message to inform AI the student got the right answer
      const systemMessage = {
        role: 'system',
        content: `El estudiante ha llegado a la respuesta correcta: "${correctOption.text}". 
                  Felicítalo por haber llegado a la respuesta correcta y explica brevemente 
                  por qué esta es la respuesta correcta. Usa la siguiente explicación: "${session.currentQuestion.explanation}"`
      };
      
      session.messages.push(systemMessage);
      
      // Generate AI congratulation message
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: session.messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const assistantMessage = {
        role: 'assistant',
        content: completion.choices[0].message.content
      };

      // Add AI message to conversation
      session.messages.push(assistantMessage);
    }

    // Format chat history for frontend
    const chatHistory = session.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    res.json({
      chatHistory,
      isCorrect,
      explanation: isCorrect ? session.currentQuestion.explanation : null
    });

  } catch (error) {
    console.error('Error checking answer:', error);
    res.status(500).json({ message: 'Error en el servidor al verificar respuesta', error: error.message });
  }
});

/**
 * Get the next question for the session
 */
router.get('/next-question', authenticate, async (req, res) => {
  try {
    const { subject, difficulty } = req.query;
    const userId = req.user.id;

    if (!subject) {
      return res.status(400).json({ message: 'Se requiere una materia válida' });
    }

    // Check if conversation exists and get current difficulty if needed
    let currentDifficulty = difficulty;
    
    if (conversations.has(userId)) {
      const session = conversations.get(userId);
      currentDifficulty = currentDifficulty || session.difficulty;
      
      // If previous question was answered correctly, check if we should increase difficulty
      if (session.isCorrect) {
        // Get user progress to determine if difficulty should increase
        const userProgress = await req.app.get('progressService').getUserProgress(userId);
        const subjectProgress = userProgress?.subjectProgress?.find(sp => sp.subject === subject);
        
        if (subjectProgress && subjectProgress.correctAnswersStreak >= 3) {
          // Increase difficulty if streak is 3 or more
          const difficultyLevels = ['facil', 'medio', 'dificil'];
          const currentIndex = difficultyLevels.indexOf(currentDifficulty);
          if (currentIndex < difficultyLevels.length - 1) {
            currentDifficulty = difficultyLevels[currentIndex + 1];
          }
        }
      }
    }

    // Get questions for this subject and difficulty, excluding the current one
    const excludedIds = [];
    if (conversations.has(userId) && conversations.get(userId).currentQuestion) {
      excludedIds.push(conversations.get(userId).currentQuestion._id);
    }

    const query = { 
      subject: subject.toLowerCase(),
      difficulty: currentDifficulty.toLowerCase()
    };

    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds };
    }

    const questions = await Question.find(query).limit(10);

    if (!questions || questions.length === 0) {
      return res.status(404).json({ 
        message: 'No hay más preguntas disponibles para esta materia y dificultad',
        noQuestionsAvailable: true
      });
    }

    // Select a random question
    const question = questions[Math.floor(Math.random() * questions.length)];

    // Initialize new conversation for this question
    if (conversations.has(userId)) {
      const session = conversations.get(userId);

      // Initialize conversation with system message
      const initialMessages = [
        {
          role: 'system',
          content: `Eres un tutor socrático enfocado en ${subject}. 
                    Tu objetivo es guiar al estudiante a través del método socrático para que descubra la respuesta por sí mismo.
                    No reveles la respuesta directamente, sino que haz preguntas para que el estudiante pueda llegar a la respuesta correcta.
                    Eres un experto en promover el pensamiento crítico.
                    La pregunta actual es: "${question.questionText}".
                    Las opciones son: ${question.options.map(opt => `"${opt.text}"`).join(', ')}.
                    La respuesta correcta es: "${question.options.find(opt => opt.isCorrect).text}".
                    La explicación es: "${question.explanation}".
                    Comienza presentando la nueva pregunta actual. Luego, inicia el diálogo socrático.
                    NO DES LA RESPUESTA CORRECTA DIRECTAMENTE.`
        }
      ];

      // Create new conversation session
      session.messages = initialMessages;
      session.currentQuestion = question;
      session.difficulty = currentDifficulty;
      session.isCorrect = false;

      // Generate initial AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: initialMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const assistantMessage = {
        role: 'assistant',
        content: completion.choices[0].message.content
      };

      // Add AI message to conversation history
      session.messages.push(assistantMessage);

      // Update stored conversation
      conversations.set(userId, session);

      // Format chat history for frontend (excluding system message)
      const chatHistory = [assistantMessage];

      res.json({
        chatHistory,
        question,
        subject,
        difficulty: currentDifficulty
      });
    } else {
      // No existing session, return just the question
      res.json({
        question,
        noSession: true
      });
    }

  } catch (error) {
    console.error('Error getting next question:', error);
    res.status(500).json({ message: 'Error en el servidor al obtener la siguiente pregunta', error: error.message });
  }
});

/**
 * Check if the user's message contains the correct answer
 */
async function analyzeIfCorrect(messages, question) {
  try {
    // Extract the last user message
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (!lastUserMessage) return { isCorrect: false };

    // Get the correct option
    const correctOption = question.options.find(opt => opt.isCorrect);
    if (!correctOption) return { isCorrect: false };

    // Prepare messages for OpenAI
    const analysisMessages = [
      {
        role: 'system',
        content: `Analiza si la respuesta del estudiante es correcta. La respuesta correcta es: "${correctOption.text}".
                  Responde SOLO con "true" si la respuesta del estudiante es correcta, o "false" si es incorrecta.`
      },
      lastUserMessage
    ];

    // Ask OpenAI to analyze
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: analysisMessages,
      temperature: 0.1,
      max_tokens: 50,
    });

    const content = completion.choices[0].message.content.toLowerCase();
    const isCorrect = content.includes('true') || 
                      content.includes('correcta') || 
                      content.includes('correcto');

    return { isCorrect };
  } catch (error) {
    console.error('Error analyzing answer:', error);
    return { isCorrect: false, error };
  }
}

module.exports = router; 