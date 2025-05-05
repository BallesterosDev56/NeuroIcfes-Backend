const mongoose = require('mongoose');
const Question = require('../models/Question');
require('dotenv').config();

const sampleQuestions = [
  {
    subject: "ingles",
    questionText: "Choose the correct word to complete the sentence: 'She is very _____ and always helps others.'",
    options: [
      {
        text: "generous",
        isCorrect: true
      },
      {
        text: "selfish",
        isCorrect: false
      },
      {
        text: "rude",
        isCorrect: false
      },
      {
        text: "lazy",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "vocabulario",
    tags: ["adjetivos", "personalidad"],
    explanation: "La palabra 'generous' (generoso) es la correcta porque describe a alguien que ayuda a otros."
  },
  {
    subject: "matematicas",
    questionText: "Resuelve la siguiente ecuación: 2x + 5 = 13",
    options: [
      {
        text: "x = 4",
        isCorrect: true
      },
      {
        text: "x = 3",
        isCorrect: false
      },
      {
        text: "x = 5",
        isCorrect: false
      },
      {
        text: "x = 6",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "algebra",
    tags: ["ecuaciones", "lineales"],
    explanation: "Para resolver: 2x + 5 = 13, restamos 5 a ambos lados: 2x = 8, luego dividimos por 2: x = 4"
  },
  {
    subject: "ciencias",
    questionText: "¿Cuál de los siguientes elementos es un gas noble?",
    options: [
      {
        text: "Helio",
        isCorrect: true
      },
      {
        text: "Hierro",
        isCorrect: false
      },
      {
        text: "Hidrógeno",
        isCorrect: false
      },
      {
        text: "Helio",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "quimica",
    tags: ["elementos", "tabla periodica"],
    explanation: "El Helio es un gas noble, ubicado en el grupo 18 de la tabla periódica."
  },
  {
    subject: "lenguaje",
    questionText: "Identifica el tipo de narrador en el siguiente texto: 'Me levanté temprano y fui al mercado. Compré frutas y verduras para la semana.'",
    options: [
      {
        text: "Primera persona",
        isCorrect: true
      },
      {
        text: "Tercera persona",
        isCorrect: false
      },
      {
        text: "Omnisciente",
        isCorrect: false
      },
      {
        text: "Testigo",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "literatura",
    tags: ["narrador", "punto de vista"],
    explanation: "El narrador usa la primera persona ('me', 'fui') para contar la historia desde su propia perspectiva."
  },
  {
    subject: "sociales",
    questionText: "¿Cuál fue el primer presidente de Colombia después de la independencia?",
    options: [
      {
        text: "Simón Bolívar",
        isCorrect: true
      },
      {
        text: "Francisco de Paula Santander",
        isCorrect: false
      },
      {
        text: "Antonio Nariño",
        isCorrect: false
      },
      {
        text: "José María Córdova",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "historia",
    tags: ["independencia", "presidentes"],
    explanation: "Simón Bolívar fue el primer presidente de la Gran Colombia después de la independencia en 1819."
  },
  {
    subject: "ingles",
    questionText: "Select the correct form of the verb: 'She _____ to the store every day.'",
    options: [
      {
        text: "goes",
        isCorrect: true
      },
      {
        text: "go",
        isCorrect: false
      },
      {
        text: "going",
        isCorrect: false
      },
      {
        text: "went",
        isCorrect: false
      }
    ],
    difficulty: "facil",
    category: "gramatica",
    tags: ["verbos", "presente simple"],
    explanation: "Se usa 'goes' porque es la tercera persona del singular en presente simple."
  }
];

async function seedQuestions() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conectado a la base de datos');

    // Limpiar preguntas existentes
    await Question.deleteMany({});
    console.log('Base de datos limpiada');

    // Insertar nuevas preguntas
    await Question.insertMany(sampleQuestions);
    console.log('Preguntas insertadas exitosamente');

    // Desconectar de la base de datos
    await mongoose.disconnect();
    console.log('Desconectado de la base de datos');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedQuestions(); 