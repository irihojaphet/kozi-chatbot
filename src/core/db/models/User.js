const { pool } = require('../connection');
const logger = require('../../utils/logger');

class User {
  static async create(userData) {
    const { email, user_type = 'employee' } = userData;
    const query = `
      INSERT INTO users (email, user_type) 
      VALUES (?, ?)
    `;
    
    try {
      const [result] = await pool.execute(query, [email, user_type]);
      logger.info('User created', { userId: result.insertId, email });
      return result.insertId;
    } catch (error) {
      logger.error('Error creating user', { error: error.message, email });
      throw error;
    }
  }

  static async findById(userId) {
    const query = 'SELECT * FROM users WHERE id = ? AND is_active = true';
    
    try {
      const [rows] = await pool.execute(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID', { error: error.message, userId });
      throw error;
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ? AND is_active = true';
    
    try {
      const [rows] = await pool.execute(query, [email]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email', { error: error.message, email });
      throw error;
    }
  }

  static async updateProfileCompletion(userId, percentage) {
    const query = 'UPDATE users SET profile_completion_percentage = ? WHERE id = ?';
    
    try {
      await pool.execute(query, [percentage, userId]);
      logger.info('Profile completion updated', { userId, percentage });
    } catch (error) {
      logger.error('Error updating profile completion', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = User;