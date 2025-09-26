const { pool } = require('../connection');
const logger = require('../../utils/logger');
const { BOT_TYPES } = require('../../../config/constants');

class ChatSession {
  static async create(userId, sessionId, botType = BOT_TYPES.EMPLOYEE) {
    const query = `
      INSERT INTO chat_sessions (user_id, session_id, bot_type, messages, context) 
      VALUES (?, ?, ?, JSON_ARRAY(), JSON_OBJECT())
    `;
    
    try {
      const [result] = await pool.execute(query, [userId, sessionId, botType]);
      logger.info('Chat session created', { userId, sessionId, botType });
      return result.insertId;
    } catch (error) {
      logger.error('Error creating chat session', { error: error.message, userId, sessionId });
      throw error;
    }
  }

  static async findBySessionId(sessionId) {
    const query = 'SELECT * FROM chat_sessions WHERE session_id = ? AND is_active = true';
    
    try {
      const [rows] = await pool.execute(query, [sessionId]);
      const session = rows[0];
      
      if (session) {
        // Parse JSON fields
        session.messages = JSON.parse(session.messages || '[]');
        session.context = JSON.parse(session.context || '{}');
      }
      
      return session || null;
    } catch (error) {
      logger.error('Error finding chat session', { error: error.message, sessionId });
      throw error;
    }
  }

  static async addMessage(sessionId, message, sender = 'user') {
    const session = await this.findBySessionId(sessionId);
    if (!session) throw new Error('Chat session not found');

    const newMessage = {
      sender,
      message,
      timestamp: new Date().toISOString()
    };

    session.messages.push(newMessage);

    const query = 'UPDATE chat_sessions SET messages = ? WHERE session_id = ?';
    
    try {
      await pool.execute(query, [JSON.stringify(session.messages), sessionId]);
      logger.info('Message added to chat session', { sessionId, sender });
    } catch (error) {
      logger.error('Error adding message to chat session', { error: error.message, sessionId });
      throw error;
    }
  }

  static async updateContext(sessionId, contextUpdate) {
    const session = await this.findBySessionId(sessionId);
    if (!session) throw new Error('Chat session not found');

    const updatedContext = { ...session.context, ...contextUpdate };
    const query = 'UPDATE chat_sessions SET context = ? WHERE session_id = ?';

    try {
      await pool.execute(query, [JSON.stringify(updatedContext), sessionId]);
      logger.info('Chat session context updated', { sessionId });
    } catch (error) {
      logger.error('Error updating chat session context', { error: error.message, sessionId });
      throw error;
    }
  }

  static async getRecentSessions(userId, limit = 10) {
    const query = `
      SELECT session_id, bot_type, created_at 
      FROM chat_sessions 
      WHERE user_id = ? AND is_active = true 
      ORDER BY updated_at DESC 
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [userId, limit]);
      return rows;
    } catch (error) {
      logger.error('Error getting recent chat sessions', { error: error.message, userId });
      throw error;
    }
  }

  static async deactivate(sessionId) {
    const query = 'UPDATE chat_sessions SET is_active = false WHERE session_id = ?';

    try {
      await pool.execute(query, [sessionId]);
      logger.info('Chat session deactivated', { sessionId });
    } catch (error) {
      logger.error('Error deactivating chat session', { error: error.message, sessionId });
      throw error;
    }
  }
}

module.exports = ChatSession;