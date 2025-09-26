const { ChatOpenAI } = require('@langchain/openai');
const env = require('../config/environment');
const logger = require('../core/utils/logger');

class OpenAIService {
  constructor() {
    this.chatModel = new ChatOpenAI({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: env.CHAT_MODEL,
      temperature: 0.7
    });
  }

  async generateResponse(messages, systemPrompt = null) {
    try {
      const formattedMessages = [];
      
      if (systemPrompt) {
        formattedMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      formattedMessages.push(...messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.message
      })));

      const response = await this.chatModel.invoke(formattedMessages);
      
      logger.info('OpenAI response generated', { 
        messageCount: messages.length,
        model: env.CHAT_MODEL 
      });

      return response.content;
    } catch (error) {
      logger.error('OpenAI API error', { error: error.message });
      throw error;
    }
  }

  async summarizeConversation(messages) {
    const summaryPrompt = `Summarize the key points from this conversation between a job seeker and Kozi support. Focus on:
- User's profile completion status
- Issues discussed
- Actions taken or needed
- Important context for future interactions`;

    try {
      const conversationText = messages.map(msg => 
        `${msg.sender}: ${msg.message}`
      ).join('\n');

      const response = await this.chatModel.invoke([
        { role: 'system', content: summaryPrompt },
        { role: 'user', content: conversationText }
      ]);

      return response.content;
    } catch (error) {
      logger.error('Conversation summary failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = OpenAIService;