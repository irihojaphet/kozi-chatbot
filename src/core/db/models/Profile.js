const { pool } = require('../connection');
const logger = require('../../utils/logger');

class Profile {
  static async create(userId, profileData = {}) {
    const query = `
      INSERT INTO profiles (user_id, full_name, phone, location) 
      VALUES (?, ?, ?, ?)
    `;
    
    const { full_name, phone, location } = profileData;
    
    try {
      const [result] = await pool.execute(query, [userId, full_name || null, phone || null, location || null]);
      logger.info('Profile created', { userId, profileId: result.insertId });
      return result.insertId;
    } catch (error) {
      logger.error('Error creating profile', { error: error.message, userId });
      throw error;
    }
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM profiles WHERE user_id = ?';
    
    try {
      const [rows] = await pool.execute(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding profile', { error: error.message, userId });
      throw error;
    }
  }

  static async update(userId, updateData) {
    const allowedFields = ['full_name', 'phone', 'location', 'date_of_birth', 'job_category', 'experience_level'];
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) return false;

    const query = `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = ?`;
    values.push(userId);

    try {
      const [result] = await pool.execute(query, values);
      logger.info('Profile updated', { userId, updatedFields: Object.keys(updateData) });
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error updating profile', { error: error.message, userId });
      throw error;
    }
  }

  static async updateDocumentStatus(userId, docType, status, filePath = null) {
    const validTypes = ['cv', 'id', 'photo'];
    if (!validTypes.includes(docType)) {
      throw new Error('Invalid document type');
    }

    const uploadedField = `${docType}_uploaded`;
    const pathField = `${docType}_file_path`;
    
    const query = `UPDATE profiles SET ${uploadedField} = ?, ${pathField} = ? WHERE user_id = ?`;

    try {
      await pool.execute(query, [status, filePath, userId]);
      logger.info('Document status updated', { userId, docType, status });
    } catch (error) {
      logger.error('Error updating document status', { error: error.message, userId, docType });
      throw error;
    }
  }

  static async calculateCompletionPercentage(userId) {
    const profile = await this.findByUserId(userId);
    if (!profile) return 0;

    const requiredFields = ['full_name', 'phone', 'location', 'job_category'];
    const requiredDocs = ['cv_uploaded', 'id_uploaded'];
    
    const completedFields = requiredFields.filter(field => profile[field]);
    const completedDocs = requiredDocs.filter(field => profile[field]);
    
    const totalRequired = requiredFields.length + requiredDocs.length;
    const totalCompleted = completedFields.length + completedDocs.length;
    
    return Math.round((totalCompleted / totalRequired) * 100);
  }
}

module.exports = Profile;