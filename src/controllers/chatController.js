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

      const result = await this.chatService.startSession(user_id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Start session failed', { error: error.message });
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

      const result = await this.chatService.sendMessage(session_id, user_id, message);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Send message failed', { error: error.message });
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
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get history failed', { error: error.message });
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

      const result = await this.chatService.endSession(session_id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('End session failed', { error: error.message });
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

      const result = await this.chatService.getProfileGuidance(user_id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get guidance failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get profile guidance'
      });
    }
  }
}

module.exports = ChatController;