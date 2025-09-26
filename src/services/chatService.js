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

      // --- DEBUG: show inbound payload
      logger.info('chat-inbound', { sessionId, userId, msgPreview: String(message).slice(0, 140) });

      // Check if message is Kozi-related (more tolerant)
      const isKozi = this._isKoziRelated(message);

      // --- DEBUG: show kozi routing decision
      logger.info('chat-scope-decision', { sessionId, userId, isKoziRelated: isKozi });

      if (!isKozi) {
        // Friendly handling for positive/closing feedback (e.g., "great", "thanks")
        if (this._isPositiveClosure(message)) {
          const closing = this._friendlyClosing();
          await ChatSession.addMessage(sessionId, closing, 'assistant');
          logger.info('chat-outbound-closing', { sessionId, userId });
          return { message: closing, debug: { scope: 'NO', reason: 'positive_closure' } };
        }

        // Gentle guidance for unrelated topics (not rude; include what we do + support)
        const guidance = this._gentleRedirect();
        await ChatSession.addMessage(sessionId, guidance, 'assistant');
        logger.info('chat-outbound-gentle-redirect', { sessionId, userId });
        return { message: guidance, debug: { scope: 'NO', reason: 'unrelated' } };
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

      return { message: response, debug: { scope: 'YES' } };
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

  /**
   * Heuristic: decide if a message is Kozi-dashboard related.
   * More tolerant:
   * - Accept common greetings/help intents (user is already inside Kozi app)
   * - Accept typical profile/upload/jobs/CV words without needing "kozi"
   * - Simple regex for "finish/complete/100%" phrasing
   */
  _isKoziRelated(message) {
    const text = String(message || '').toLowerCase().trim();

    if (!text) return false;

    // Friendly greetings / general help that should NOT bounce to support
    const greetingOrHelp = /\b(hi|hello|hey|good (morning|afternoon|evening)|help|assist|guide|question|please)\b/.test(text);
    if (greetingOrHelp) return true;

    // Explicit task intents
    const koziKeywords = [
      // profile/account
      'profile', 'account', 'complete', 'completion', 'progress', 'percentage', '100%',
      // uploads / identity
      'upload', 'document', 'doc', 'file', 'id', 'national id', 'nid', 'passport', 'photo', 'picture',
      // cv / resume
      'cv', 'resume', 'summary', 'experience', 'skills', 'education',
      // jobs / applications
      'job', 'jobs', 'work', 'employment', 'apply', 'application', 'vacancy', 'position',
      // platform cues
      'kozi', 'dashboard',
      'fee','fees','service fee','registration','price','pricing','cost','costs'
    ];

    if (koziKeywords.some(kw => text.includes(kw))) return true;

    // Common phrasing that implies Kozi tasks without explicit keywords
    const impliedTasks =
      /(finish|complete|reach)\s+(my\s+)?(profile|account)|reach\s*100\s*%/.test(text) ||
      /(upload|add)\s+(my\s+)?(id|photo|cv|resume|documents?)/.test(text) ||
      /(help|how).*(profile|cv|resume|job|apply|upload)/.test(text);

    if (impliedTasks) return true;

    return false;
  }

  // Detect short positive/closing feedback so we respond warmly, not with support line
  _isPositiveClosure(message) {
    const t = String(message || '').toLowerCase().trim();
    if (!t) return false;
    return /\b(thanks|thank you|great|awesome|nice|cool|perfect|got it|okay|ok|good|sounds good|cheers|appreciated)\b/.test(t)
        || /\b(bye|goodbye|see you|later)\b/.test(t);
  }

  _friendlyClosing() {
    return (
      "You're welcome! 🙌 If you need anything else on your Kozi dashboard—profile completion, document uploads, job search, or CV help—just ask.\n" +
      "For topics outside Kozi, our Support Team is happy to help: 📧 support@kozi.rw | ☎ +250 788 123 456.\n" +
      "✨ Every completed profile and polished CV gives you more visibility with employers."
    );
  }

  _gentleRedirect() {
    return (
      "Here’s what I can help you with on Kozi:\n" +
      "• Completing or updating your profile\n" +
      "• Uploading your ID, CV, and profile photo\n" +
      "• Searching and applying for jobs\n" +
      "• Creating or improving a professional CV\n\n" +
      "If your question is outside the Kozi platform, our Support Team can assist you further:\n" +
      "📧 support@kozi.rw | ☎ +250 788 123 456."
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

    const messageWords = String(message || '').toLowerCase().split(/\s+/);
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
