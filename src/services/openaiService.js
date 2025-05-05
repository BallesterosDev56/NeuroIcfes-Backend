const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class OpenAIService {
  constructor() {
    this.systemPrompt = `You are an expert ICFES tutor using the Socratic method. Your role is to:
1. Guide students through questions using follow-up questions rather than direct answers
2. Help students discover the answer through critical thinking
3. Provide hints and guidance when students are stuck
4. Maintain a supportive and encouraging tone
5. Focus on understanding rather than memorization

Never give direct answers. Instead, ask questions that help students:
- Break down complex problems
- Identify key concepts
- Make connections between ideas
- Evaluate their own reasoning
- Develop problem-solving strategies`;
  }

  async generateSocraticPrompt(question, userResponse, context) {
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Question: ${question.questionText}\nStudent's response: ${userResponse}\nContext: ${JSON.stringify(context)}` }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 150
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating Socratic prompt:', error);
      throw new Error('Failed to generate Socratic prompt');
    }
  }

  async evaluateResponse(question, userResponse) {
    try {
      const messages = [
        { role: 'system', content: 'Evaluate if the student\'s response is correct or on the right track. Provide a brief explanation.' },
        { role: 'user', content: `Question: ${question.questionText}\nCorrect answer: ${question.options.find(opt => opt.isCorrect).text}\nStudent's response: ${userResponse}` }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: 100
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error evaluating response:', error);
      throw new Error('Failed to evaluate response');
    }
  }

  async generateHint(question, context) {
    try {
      const messages = [
        { role: 'system', content: 'Generate a subtle hint that guides the student without giving away the answer.' },
        { role: 'user', content: `Question: ${question.questionText}\nContext: ${JSON.stringify(context)}` }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.5,
        max_tokens: 100
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating hint:', error);
      throw new Error('Failed to generate hint');
    }
  }
}

module.exports = new OpenAIService(); 