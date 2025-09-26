const ProfileService = require('../services/profileService');
const { User } = require('../core/db/models');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../core/utils/logger');

class ProfileController {
  constructor() {
    this.profileService = new ProfileService();
  }

  async createUser(req, res) {
    try {
      const { email, user_type = 'employee' } = req.body;
      
      if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'email is required'
        });
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'User already exists'
        });
      }

      const userId = await User.create({ email, user_type });
      await this.profileService.getOrCreateProfile(userId);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: {
          user_id: userId,
          email,
          user_type
        }
      });
    } catch (error) {
      logger.error('Create user failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to create user'
      });
    }
  }

  async getProfile(req, res) {
    try {
      const { user_id } = req.params;
      
      if (!user_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'user_id is required'
        });
      }

      const profileStatus = await this.profileService.getProfileStatus(user_id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: profileStatus
      });
    } catch (error) {
      logger.error('Get profile failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve profile'
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const { user_id } = req.params;
      const updateData = req.body;
      
      if (!user_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'user_id is required'
        });
      }

      const result = await this.profileService.updateProfile(user_id, updateData);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Update profile failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  async uploadDocument(req, res) {
    try {
      const { user_id } = req.params;
      const { doc_type, file_path } = req.body;
      
      if (!user_id || !doc_type || !file_path) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'user_id, doc_type, and file_path are required'
        });
      }

      const validTypes = ['cv', 'id', 'photo'];
      if (!validTypes.includes(doc_type)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'doc_type must be cv, id, or photo'
        });
      }

      const result = await this.profileService.uploadDocument(user_id, doc_type, file_path);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Upload document failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to upload document'
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

      const guidance = await this.profileService.getProfileGuidance(user_id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: guidance
      });
    } catch (error) {
      logger.error('Get profile guidance failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get profile guidance'
      });
    }
  }

  async getUserByEmail(req, res) {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'email is required'
        });
      }

      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: 'User not found'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user_id: user.id,
          email: user.email,
          user_type: user.user_type,
          profile_completion: user.profile_completion_percentage
        }
      });
    } catch (error) {
      logger.error('Get user by email failed', { error: error.message });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve user'
      });
    }
  }
}

module.exports = ProfileController;