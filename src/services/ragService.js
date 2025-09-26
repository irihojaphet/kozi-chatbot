const VectorService = require('./vectorService');
const OpenAIService = require('./openaiService');
const logger = require('../core/utils/logger');

class RAGService {
  constructor() {
    this.vectorService = new VectorService();
    this.openaiService = new OpenAIService();
  }

  async initialize() {
    try {
      await this.vectorService.initialize();
      logger.info('RAG service initialized');
    } catch (error) {
      logger.error('RAG service initialization failed', { error: error.message });
      throw error;
    }
  }

  async addKnowledgeDocument(id, content, metadata = {}) {
    try {
      await this.vectorService.addDocument(id, content, metadata);
      logger.info('Knowledge document added', { id, type: metadata.type });
    } catch (error) {
      logger.error('Failed to add knowledge document', { error: error.message, id });
      throw error;
    }
  }

  async getRelevantContext(query, limit = 3) {
    try {
      const results = await this.vectorService.search(query, limit);
      
      const context = results
        .filter(result => result.similarity > 0.7) // Only include relevant results
        .map(result => result.text)
        .join('\n\n');

      logger.info('Retrieved relevant context', { 
        query, 
        resultsCount: results.length,
        relevantCount: results.filter(r => r.similarity > 0.7).length 
      });

      return context;
    } catch (error) {
      logger.error('Context retrieval failed', { error: error.message, query });
      return ''; // Return empty context on failure
    }
  }

  async generateContextualResponse(userMessage, chatHistory = [], userContext = {}) {
    try {
      // Get relevant knowledge from vector store
      const relevantContext = await this.getRelevantContext(userMessage);
      
      // Build system prompt with context
      const systemPrompt = this._buildSystemPrompt(relevantContext, userContext);
      
      // Generate response using OpenAI
      const response = await this.openaiService.generateResponse(
        [{ sender: 'user', message: userMessage }, ...chatHistory],
        systemPrompt
      );

      logger.info('Contextual response generated', { 
        hasContext: relevantContext.length > 0,
        userMessageLength: userMessage.length 
      });

      return response;
    } catch (error) {
      logger.error('Contextual response generation failed', { error: error.message });
      throw error;
    }
  }

  _buildSystemPrompt(relevantContext, userContext) {
    const basePrompt = `You are KOZI DASHBOARD AGENT, the official virtual assistant for Kozi users (job seekers). 

CORE BEHAVIOR:
- Always greet users warmly, acknowledging they have a Kozi account
- Help with profile completion, job applications, and CV preparation
- Provide step-by-step guidance
- Be friendly, encouraging, and professional
- End responses with motivation about profile completion

SCOPE: Only answer Kozi-related questions about:
- Profile completion/updating
- Document uploads (ID, CV, profile photo)
- Job searching and applications
- CV creation and improvement

If unrelated question → redirect: "Please contact our Support Team 📧 support@kozi.rw | ☎ +250 788 123 456"`;

    let contextSection = '';
    if (relevantContext) {
      contextSection = `\nRELEVANT KOZI INFORMATION:\n${relevantContext}\n`;
    }

    let userSection = '';
    if (userContext.profileCompletion !== undefined) {
      userSection = `\nUSER STATUS:\n- Profile completion: ${userContext.profileCompletion}%\n`;
    }

    return basePrompt + contextSection + userSection;
  }
}

module.exports = RAGService;