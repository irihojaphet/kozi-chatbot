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

  // NEW: expose file indexing to KnowledgeLoader
  async indexFile(absPath, metadata = {}) {
    return this.vectorService.indexFile(absPath, metadata);
  }

  async getRelevantContext(query, limit = 6) {
    try {
      const normalized = this._normalizeQuery(query);
      const results = await this.vectorService.search(normalized, limit);

      // Lower the cut-off to catch paraphrases (was 0.7)
      const MIN = 0.55;

      const context = results
        .filter(result => result.similarity >= MIN)
        .map(result => result.text)
        .join('\n\n');

      logger.info('Retrieved relevant context', {
        query,
        normalized,
        resultsCount: results.length,
        relevantCount: results.filter(r => r.similarity >= MIN).length
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

  // Normalize common user phrasing to improve matching
  _normalizeQuery(text) {
    let t = String(text || '');

    // “registration fee” ≈ “service fee” / “fee”, expand synonyms to improve hits
    t = t.replace(/\bregistration fee(s)?\b/gi, 'service fee');
    t = t.replace(/\bservice fee(s)?\b/gi, 'service fee fees price prices cost costs');

    // other light expansions that help
    t = t.replace(/\bprice(s)?\b/gi, 'price prices cost costs fee fees');
    t = t.replace(/\bcost(s)?\b/gi, 'cost costs price prices fee fees');

    return t;
  }
}

module.exports = RAGService;
