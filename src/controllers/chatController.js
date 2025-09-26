const ChatService = require('../services/chatService');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../core/utils/logger');

class ChatController {
  constructor() {
    this.chatService = new ChatService();
  }

  async initialize() {
    await this.chatService.initialize();
  }

  async startSession(req, res) {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'user_id is required'
        });
      }

      // 🔎 Trace: starting session (logger + console)
      logger.info('chat-start', { user_id });
      console.log('chat-start', { user_id });

      const result = await this.chatService.startSession(user_id);

      // 🔎 Trace: session result
      logger.info('chat-start-result', {
        user_id,
        session_id: result?.session_id
      });
      console.log('chat-start-result', {
        user_id,
        session_id: result?.session_id
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Start session failed', { error: error.message });
      console.error('Start session failed', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to start chat session'
      });
    }
  }

  async sendMessage(req, res) {
    try {
      const { session_id, user_id, message } = req.body;

      if (!session_id || !user_id || !message) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'session_id, user_id, and message are required'
        });
      }

      // 🔎 Trace: inbound user message
      logger.info('chat-inbound', { session_id, user_id, msg: message });
      console.log('chat-inbound', { session_id, user_id, msg: message });

      const result = await this.chatService.sendMessage(session_id, user_id, message);

      // ✅ If ChatService attaches debug (e.g., { scope, hits }), log it. Safe if absent.
      if (result && result.debug) {
        logger.info('chat-debug', result.debug);
        console.log('chat-debug', result.debug);
      }

      // 🔎 Trace: outbound assistant message (preview)
      const preview =
        typeof result?.message === 'string'
          ? result.message.slice(0, 140)
          : undefined;

      logger.info('chat-outbound', {
        session_id,
        user_id,
        msgPreview: preview,
        length: typeof result?.message === 'string' ? result.message.length : undefined
      });
      console.log('chat-outbound', {
        session_id,
        user_id,
        msgPreview: preview,
        length: typeof result?.message === 'string' ? result.message.length : undefined
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Send message failed', { error: error.message });
      console.error('Send message failed', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to process message'
      });
    }
  }

  async getHistory(req, res) {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'session_id is required'
        });
      }

      const result = await this.chatService.getSessionHistory(session_id);

      // 🔎 Trace: history fetch
      const count = Array.isArray(result?.messages) ? result.messages.length : 0;
      logger.info('chat-history', { session_id, count });
      console.log('chat-history', { session_id, count });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get history failed', { error: error.message });
      console.error('Get history failed', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve chat history'
      });
    }
  }

  async endSession(req, res) {
    try {
      const { session_id } = req.body;

      if (!session_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'session_id is required'
        });
      }

      // 🔎 Trace: ending session
      logger.info('chat-end', { session_id });
      console.log('chat-end', { session_id });

      const result = await this.chatService.endSession(session_id);

      // 🔎 Trace: ended
      logger.info('chat-end-result', { session_id, ended: true });
      console.log('chat-end-result', { session_id, ended: true });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('End session failed', { error: error.message });
      console.error('End session failed', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to end chat session'
      });
    }
  }

  async getGuidance(req, res) {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'user_id is required'
        });
      }

      // 🔎 Trace: guidance request
      logger.info('chat-guidance', { user_id });
      console.log('chat-guidance', { user_id });

      const result = await this.chatService.getProfileGuidance(user_id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get guidance failed', { error: error.message });
      console.error('Get guidance failed', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get profile guidance'
      });
    }
  }
}

module.exports = ChatController;
