const { ChatSession } = require('../core/db/models');
const RAGService = require('./ragService');
const ProfileService = require('./profileService');
const { CHAT_RESPONSES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const logger = require('../core/utils/logger');

class ChatService {
  constructor() {
    this.ragService = new RAGService();
    this.profileService = new ProfileService();
  }

  async initialize() {
    await this.ragService.initialize();
    logger.info('Chat service initialized');
  }

  async startSession(userId) {
    try {
      const sessionId = uuidv4();
      await ChatSession.create(userId, sessionId, 'employee');
      
      logger.info('Chat session started', { userId, sessionId });
      
      return {
        session_id: sessionId,
        message: CHAT_RESPONSES.WELCOME
      };
    } catch (error) {
      logger.error('Failed to start chat session', { error: error.message, userId });
      throw error;
    }
  }

  async sendMessage(sessionId, userId, message) {
    try {
      // Add user message to session
      await ChatSession.addMessage(sessionId, message, 'user');
      
      // Check if message is Kozi-related
      if (!this._isKoziRelated(message)) {
        const response = CHAT_RESPONSES.REDIRECT_SUPPORT;
        await ChatSession.addMessage(sessionId, response, 'assistant');
        
        return { message: response };
      }

      // Get user profile context
      const profileStatus = await this.profileService.getProfileStatus(userId);
      
      // Get chat history
      const session = await ChatSession.findBySessionId(sessionId);
      const recentMessages = session.messages.slice(-10); // Last 10 messages
      
      // Generate contextual response
      const response = await this.ragService.generateContextualResponse(
        message,
        recentMessages,
        { 
          profileCompletion: profileStatus.completion_percentage,
          missingFields: profileStatus.missing_fields
        }
      );

      // Add assistant response to session
      await ChatSession.addMessage(sessionId, response, 'assistant');
      
      // Update session context with profile info
      await ChatSession.updateContext(sessionId, {
        last_profile_completion: profileStatus.completion_percentage,
        topics_discussed: this._extractTopics(message)
      });

      logger.info('Message processed', { sessionId, userId, messageLength: message.length });

      return { message: response };
    } catch (error) {
      logger.error('Message processing failed', { error: error.message, sessionId, userId });
      
      const errorResponse = CHAT_RESPONSES.ERROR_GENERIC;
      await ChatSession.addMessage(sessionId, errorResponse, 'assistant');
      
      return { message: errorResponse };
    }
  }

  async getSessionHistory(sessionId) {
    try {
      const session = await ChatSession.findBySessionId(sessionId);
      
      if (!session) {
        throw new Error('Chat session not found');
      }

      return {
        session_id: sessionId,
        messages: session.messages,
        context: session.context
      };
    } catch (error) {
      logger.error('Failed to get session history', { error: error.message, sessionId });
      throw error;
    }
  }

  async endSession(sessionId) {
    try {
      await ChatSession.deactivate(sessionId);
      logger.info('Chat session ended', { sessionId });
      
      return { message: 'Session ended. Thank you for using Kozi!' };
    } catch (error) {
      logger.error('Failed to end session', { error: error.message, sessionId });
      throw error;
    }
  }

  async getProfileGuidance(userId) {
    try {
      return await this.profileService.getProfileGuidance(userId);
    } catch (error) {
      logger.error('Failed to get profile guidance', { error: error.message, userId });
      throw error;
    }
  }

  _isKoziRelated(message) {
    const koziKeywords = [
      'profile', 'cv', 'job', 'work', 'employment', 'upload', 'document',
      'id', 'photo', 'complete', 'apply', 'kozi', 'salary', 'employer',
      'experience', 'skills', 'education', 'phone', 'location', 'name'
    ];

    const messageWords = message.toLowerCase().split(/\s+/);
    return koziKeywords.some(keyword => 
      messageWords.some(word => word.includes(keyword))
    );
  }

  _extractTopics(message) {
    const topicMap = {
      profile: ['profile', 'complete', 'update', 'information'],
      cv: ['cv', 'resume', 'curriculum'],
      jobs: ['job', 'work', 'employment', 'apply', 'application'],
      documents: ['upload', 'document', 'id', 'photo', 'file'],
      help: ['help', 'support', 'assist', 'guide']
    };

    const messageWords = message.toLowerCase().split(/\s+/);
    const detectedTopics = [];

    Object.entries(topicMap).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => 
        messageWords.some(word => word.includes(keyword))
      )) {
        detectedTopics.push(topic);
      }
    });

    return detectedTopics;
  }
}

module.exports = ChatService;