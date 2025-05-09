const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Question = require('../models/Question');
const { OpenAI } = require('openai');
const SharedContent = require('../models/SharedContent');

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
    const { subject, sharedContentId } = req.body;
    const userId = req.user.id;
    
    if (!subject) {
      return res.status(400).json({ message: 'Se requiere una materia válida' });
    }

    // Get user progress to determine difficulty
    const userProgress = await req.app.get('progressService').getUserProgress(userId);
    const difficulty = userProgress?.subjectProgress?.find(sp => sp.subject === subject)?.currentDifficulty || 'facil';

    // Si hay un ID de contenido compartido, manejar diferente
    if (sharedContentId) {
      const sharedContentRequested = await SharedContent.findById(sharedContentId);
      
      if (!sharedContentRequested) {
        return res.status(404).json({ 
          message: 'Contenido compartido no encontrado',
          noQuestionsAvailable: true
        });
      }
      
      const questions = await Question.find({ 
        sharedContentId: sharedContentId 
      }).sort({ position: 1 });
      
      if (!questions || questions.length === 0) {
        return res.status(404).json({ 
          message: 'No hay preguntas disponibles para este contenido',
          noQuestionsAvailable: true
        });
      }
      
      // Seleccionar la primera pregunta
      const question = questions[0];
      
      // Si la pregunta tiene contenido compartido, obtenerlo
      let totalQuestionsInSharedContent = questions.length;
      let currentQuestionNumber = 1;
      
      // Adaptar el prompt para incluir el contenido compartido
      let systemPrompt = `Eres un tutor socrático enfocado en ${subject}. 
                Tu objetivo es guiar al estudiante a través del método socrático para que descubra la respuesta por sí mismo.
                No reveles la respuesta directamente.`;
                
      if (sharedContentRequested.contentType === 'text') {
        systemPrompt += `\nEl estudiante está trabajando con el siguiente texto: "${sharedContentRequested.textContent}"`;
      } else if (sharedContentRequested.contentType === 'image' || sharedContentRequested.contentType === 'graph') {
        systemPrompt += `\nEl estudiante está trabajando con una ${sharedContentRequested.contentType === 'image' ? 'imagen' : 'gráfica'} titulada "${sharedContentRequested.title}"`;
        
        if (sharedContentRequested.imageDescription) {
          systemPrompt += `\nDescripción de la imagen: ${sharedContentRequested.imageDescription}`;
        }
        
        if (sharedContentRequested.imageElements && sharedContentRequested.imageElements.length > 0) {
          systemPrompt += `\nLa imagen contiene los siguientes elementos importantes:`;
          sharedContentRequested.imageElements.forEach(element => {
            systemPrompt += `\n- Elemento ${element.elementId}: ${element.description}${element.coordinates ? ` (ubicado en ${element.coordinates})` : ''}`;
          });
        }
      } else if (sharedContentRequested.contentType === 'mixed') {
        systemPrompt += `\nEl estudiante está trabajando con un contenido mixto titulado "${sharedContentRequested.title}"`;
        
        if (sharedContentRequested.textContent) {
          systemPrompt += `\nTexto: "${sharedContentRequested.textContent}"`;
        }
        
        if (sharedContentRequested.imageDescription) {
          systemPrompt += `\nDescripción de la imagen: ${sharedContentRequested.imageDescription}`;
        }
      }
      
      systemPrompt += `\nLa pregunta actual es: "${question.questionText}".
                Las opciones son: ${question.options.map(opt => `"${opt.text}"`).join(', ')}.
                La respuesta correcta es: "${question.options.find(opt => opt.isCorrect).text}".
                NO DES LA RESPUESTA CORRECTA DIRECTAMENTE.`;
      
      // Initialize conversation with system message
      const initialMessages = [
        {
          role: 'system',
          content: systemPrompt
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
        userId,
        sharedContent: sharedContentRequested,
        totalQuestions: totalQuestionsInSharedContent,
        currentQuestionNumber: currentQuestionNumber
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
        difficulty,
        sharedContent: sharedContentRequested,
        totalQuestions: totalQuestionsInSharedContent
      });
      
      return;
    }

    // Para preguntas normales (sin contenido compartido), continuar con la lógica existente
    const query = { 
      subject: subject.toLowerCase(),
      difficulty: difficulty.toLowerCase(),
      // Incluir tanto preguntas simples como preguntas con contenido compartido
    };

    // Solo obtenemos las preguntas que no ha respondido este usuario
    // en lugar de filtrar globalmente
    const userAnsweredQuestions = await req.app.get('progressService').getUserProgress(userId);
    const answeredQuestionIds = userAnsweredQuestions?.answeredQuestions?.map(q => q.questionId) || [];
    
    if (answeredQuestionIds.length > 0) {
      query._id = { $nin: answeredQuestionIds };
    }
    
    // Buscar preguntas, incluyendo las que tienen contenido compartido
    const questions = await Question.find(query).limit(20);

    if (!questions || questions.length === 0) {
      return res.status(404).json({ 
        message: 'No hay preguntas disponibles para esta materia y dificultad',
        noQuestionsAvailable: true
      });
    }

    // Select the first question
    const question = questions[0];

    // Si la pregunta tiene contenido compartido, obtenerlo
    let questionSharedContent = null;
    let totalQuestionsInContent = 1;
    let currentQuestionPosition = 1;
    
    if (question.sharedContentId) {
      try {
        questionSharedContent = await SharedContent.findById(question.sharedContentId);
        
        if (questionSharedContent) {
          // Obtener todas las preguntas asociadas a este contenido compartido
          const contentQuestions = await Question.find({ 
            sharedContentId: question.sharedContentId 
          }).sort({ position: 1 });
          
          totalQuestionsInContent = contentQuestions.length;
          
          // Encontrar la posición de la pregunta actual
          const questionIndex = contentQuestions.findIndex(q => 
            q._id.toString() === question._id.toString()
          );
          
          if (questionIndex >= 0) {
            currentQuestionPosition = questionIndex + 1;
          }
        }
      } catch (error) {
        console.error('Error al obtener contenido compartido:', error);
        // Continuar incluso si hay error al obtener el contenido compartido
      }
    }

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
    
    // Si hay contenido compartido, agregarlo a la sesión
    if (questionSharedContent) {
      session.sharedContent = questionSharedContent;
      session.totalQuestions = totalQuestionsInContent;
      session.currentQuestionNumber = currentQuestionPosition;
    }

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
      difficulty,
      sharedContent: questionSharedContent,
      totalQuestions: questionSharedContent ? totalQuestionsInContent : 1,
      currentQuestionNumber: questionSharedContent ? currentQuestionPosition : 1
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
      isCorrect: checkIfCorrect.isCorrect
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
                  por qué esta es la respuesta correcta.`
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
      isCorrect
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
    const { subject, difficulty, sharedContentId } = req.query;
    const userId = req.user.id;

    if (!subject) {
      return res.status(400).json({ message: 'Se requiere una materia válida' });
    }

    // Check if conversation exists and get current difficulty if needed
    let currentDifficulty = difficulty;
    let currentSharedContent = null;
    
    if (conversations.has(userId)) {
      const session = conversations.get(userId);
      currentDifficulty = currentDifficulty || session.difficulty;
      
      // Verificar si estamos trabajando con contenido compartido
      if (session.sharedContent) {
        currentSharedContent = session.sharedContent;
      }
    }
    
    // Si tenemos un ID de contenido compartido (ya sea nuevo o de la sesión existente)
    if (sharedContentId || currentSharedContent) {
      const contentId = sharedContentId || currentSharedContent._id;
      
      // Obtener el contenido compartido
      const sharedContent = sharedContentId 
        ? await SharedContent.findById(sharedContentId)
        : currentSharedContent;
      
      if (!sharedContent) {
        return res.status(404).json({ 
          message: 'Contenido compartido no encontrado',
          noQuestionsAvailable: true
        });
      }
      
      // Obtener todas las preguntas para este contenido
      const questions = await Question.find({ 
        sharedContentId: contentId 
      }).sort({ position: 1 });
      
      if (!questions || questions.length === 0) {
        return res.status(404).json({ 
          message: 'No hay preguntas disponibles para este contenido',
          noQuestionsAvailable: true
        });
      }
      
      // Obtener la pregunta actual (si existe una sesión)
      let currentPosition = 0;
      if (conversations.has(userId) && conversations.get(userId).currentQuestion) {
        const currentQuestionId = conversations.get(userId).currentQuestion._id.toString();
        // Encontrar la posición actual en el array de preguntas
        const questionIndex = questions.findIndex(q => q._id.toString() === currentQuestionId);
        if (questionIndex >= 0) {
          currentPosition = questionIndex;
        }
      }
      
      // Obtener la siguiente pregunta (si no hay más preguntas, volver a la primera)
      const nextPosition = (currentPosition + 1) % questions.length;
      const question = questions[nextPosition];
      
      // Preparar el mensaje para el modelo
      let systemPrompt = `Eres un tutor socrático enfocado en ${subject}. 
          Tu objetivo es guiar al estudiante a través del método socrático para que descubra la respuesta por sí mismo.
          No reveles la respuesta directamente.`;
                
      if (sharedContent.contentType === 'text') {
        systemPrompt += `\nEl estudiante está trabajando con el siguiente texto: "${sharedContent.textContent}"`;
      } else if (sharedContent.contentType === 'image' || sharedContent.contentType === 'graph') {
        systemPrompt += `\nEl estudiante está trabajando con una ${sharedContent.contentType === 'image' ? 'imagen' : 'gráfica'} titulada "${sharedContent.title}"`;
        
        if (sharedContent.imageDescription) {
          systemPrompt += `\nDescripción de la imagen: ${sharedContent.imageDescription}`;
        }
        
        if (sharedContent.imageElements && sharedContent.imageElements.length > 0) {
          systemPrompt += `\nLa imagen contiene los siguientes elementos importantes:`;
          sharedContent.imageElements.forEach(element => {
            systemPrompt += `\n- Elemento ${element.elementId}: ${element.description}${element.coordinates ? ` (ubicado en ${element.coordinates})` : ''}`;
          });
        }
      } else if (sharedContent.contentType === 'mixed') {
        systemPrompt += `\nEl estudiante está trabajando con un contenido mixto titulado "${sharedContent.title}"`;
        
        if (sharedContent.textContent) {
          systemPrompt += `\nTexto: "${sharedContent.textContent}"`;
        }
        
        if (sharedContent.imageDescription) {
          systemPrompt += `\nDescripción de la imagen: ${sharedContent.imageDescription}`;
        }
      }
      
      systemPrompt += `\nLa pregunta actual es: "${question.questionText}" (Pregunta ${nextPosition + 1} de ${questions.length}).
          Las opciones son: ${question.options.map(opt => `"${opt.text}"`).join(', ')}.
          La respuesta correcta es: "${question.options.find(opt => opt.isCorrect).text}".
          NO DES LA RESPUESTA CORRECTA DIRECTAMENTE.`;
      
      // Inicializar mensajes
      const initialMessages = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];
      
      // Crear o actualizar la sesión
      let session;
      if (conversations.has(userId)) {
        session = conversations.get(userId);
        session.messages = initialMessages;
        session.currentQuestion = question;
        session.isCorrect = false;
        session.sharedContent = sharedContent;
        session.totalQuestions = questions.length;
      } else {
        session = {
          messages: initialMessages,
          currentQuestion: question,
          subject,
          difficulty: currentDifficulty,
          interests: ['General'],
          isCorrect: false,
          userId,
          sharedContent,
          totalQuestions: questions.length
        };
      }
      
      // Generar respuesta inicial
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
      
      // Añadir mensaje al historial
      session.messages.push(assistantMessage);
      
      // Guardar sesión
      conversations.set(userId, session);
      
      // Formatear para el frontend
      const chatHistory = [assistantMessage];
      
      res.json({
        chatHistory,
        question,
        subject,
        difficulty: currentDifficulty,
        sharedContent,
        totalQuestions: questions.length,
        currentQuestionNumber: nextPosition + 1
      });
      
      return;
    }

    // Si llegamos aquí, es una pregunta normal (sin contenido compartido)
    
    // If previous question was answered correctly, check if we should increase difficulty
    if (conversations.has(userId) && conversations.get(userId).isCorrect) {
      // Get user progress to determine if difficulty should increase
      const userProgressInfo = await req.app.get('progressService').getUserProgress(userId);
      const subjectProgress = userProgressInfo?.subjectProgress?.find(sp => sp.subject === subject);
      
      if (subjectProgress && subjectProgress.correctAnswersStreak >= 3) {
        // Increase difficulty if streak is 3 or more
        const difficultyLevels = ['facil', 'medio', 'dificil'];
        const currentIndex = difficultyLevels.indexOf(currentDifficulty);
        if (currentIndex < difficultyLevels.length - 1) {
          currentDifficulty = difficultyLevels[currentIndex + 1];
        }
      }
    }

    // Get questions for this subject and difficulty, excluding the ones this specific user has answered
    const userAnsweredQuestions = await req.app.get('progressService').getUserProgress(userId);
    const answeredQuestionIds = userAnsweredQuestions?.answeredQuestions?.map(q => q.questionId) || [];
    
    const query = { 
      subject: subject.toLowerCase(),
      difficulty: currentDifficulty.toLowerCase(),
      questionType: 'simple', // Solo preguntas simples
    };
    
    if (answeredQuestionIds.length > 0) {
      query._id = { $nin: answeredQuestionIds };
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
                    Comienza saludando al estudiante y presentando la pregunta actual. Luego, inicia el diálogo socrático.
                    NO DES LA RESPUESTA CORRECTA DIRECTAMENTE.`
        }
      ];

      // Create new conversation session
      session.messages = initialMessages;
      session.currentQuestion = question;
      session.difficulty = currentDifficulty;
      session.isCorrect = false;
      // Eliminar cualquier referencia a contenido compartido de la sesión anterior
      delete session.sharedContent;
      delete session.totalQuestions;

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

/**
 * Get information about a specific element in an image
 */
router.post('/image-element-info', authenticate, async (req, res) => {
  try {
    const { sharedContentId, elementId } = req.body;
    const userId = req.user.id;
    
    // Verificar sesión activa
    if (!conversations.has(userId)) {
      return res.status(404).json({ message: 'No hay una conversación activa' });
    }
    
    const sharedContent = await SharedContent.findById(sharedContentId);
    if (!sharedContent || !sharedContent.imageElements) {
      return res.status(404).json({ message: 'Contenido no encontrado' });
    }
    
    const element = sharedContent.imageElements.find(el => el.elementId === parseInt(elementId));
    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Generar explicación del elemento
    const promptForElement = `
      Explica brevemente qué representa este elemento en la imagen:
      ${element.description}
      
      Contexto general de la imagen:
      ${sharedContent.imageDescription}
      
      Proporciona una explicación breve y clara que ayude a entender este elemento específico.
    `;
    
    // Llamada a OpenAI para explicación
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: 'user', content: promptForElement }],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    res.json({
      element,
      explanation: completion.choices[0].message.content
    });
    
  } catch (error) {
    console.error('Error al obtener información del elemento:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

module.exports = router; 