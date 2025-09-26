const { User, Profile } = require('../core/db/models');
const logger = require('../core/utils/logger');

class ProfileService {
  async getOrCreateProfile(userId) {
    try {
      let profile = await Profile.findByUserId(userId);
      
      if (!profile) {
        await Profile.create(userId);
        profile = await Profile.findByUserId(userId);
        logger.info('New profile created', { userId });
      }

      return profile;
    } catch (error) {
      logger.error('Failed to get/create profile', { error: error.message, userId });
      throw error;
    }
  }

  async updateProfile(userId, updateData) {
    try {
      const updated = await Profile.update(userId, updateData);
      
      if (updated) {
        // Recalculate completion percentage
        const completionPercentage = await Profile.calculateCompletionPercentage(userId);
        await User.updateProfileCompletion(userId, completionPercentage);
        
        logger.info('Profile updated', { userId, completionPercentage });
        return { updated: true, completionPercentage };
      }

      return { updated: false };
    } catch (error) {
      logger.error('Profile update failed', { error: error.message, userId });
      throw error;
    }
  }

  async uploadDocument(userId, docType, filePath) {
    try {
      await Profile.updateDocumentStatus(userId, docType, true, filePath);
      
      // Recalculate completion percentage
      const completionPercentage = await Profile.calculateCompletionPercentage(userId);
      await User.updateProfileCompletion(userId, completionPercentage);

      logger.info('Document uploaded', { userId, docType, completionPercentage });
      return { uploaded: true, completionPercentage };
    } catch (error) {
      logger.error('Document upload failed', { error: error.message, userId, docType });
      throw error;
    }
  }

  async getProfileStatus(userId) {
    try {
      const user = await User.findById(userId);
      const profile = await this.getOrCreateProfile(userId);
      
      const missingFields = [];
      const requiredFields = ['full_name', 'phone', 'location', 'job_category'];
      const requiredDocs = ['cv_uploaded', 'id_uploaded'];

      requiredFields.forEach(field => {
        if (!profile[field]) {
          missingFields.push(field.replace('_', ' '));
        }
      });

      requiredDocs.forEach(field => {
        if (!profile[field]) {
          missingFields.push(field.replace('_uploaded', '').toUpperCase());
        }
      });

      return {
        user_id: userId,
        completion_percentage: user.profile_completion_percentage,
        missing_fields: missingFields,
        profile_data: profile
      };
    } catch (error) {
      logger.error('Failed to get profile status', { error: error.message, userId });
      throw error;
    }
  }

  async getProfileGuidance(userId) {
    try {
      const status = await this.getProfileStatus(userId);
      
      let guidance = [];
      
      if (status.missing_fields.includes('full name')) {
        guidance.push("📝 Add your full name to help employers identify you");
      }
      
      if (status.missing_fields.includes('phone')) {
        guidance.push("📞 Add your phone number so employers can contact you");
      }
      
      if (status.missing_fields.includes('location')) {
        guidance.push("📍 Add your location to find nearby job opportunities");
      }
      
      if (status.missing_fields.includes('job category')) {
        guidance.push("💼 Select your job category to match relevant positions");
      }
      
      if (status.missing_fields.includes('CV')) {
        guidance.push("📄 Upload your CV to showcase your experience");
      }
      
      if (status.missing_fields.includes('ID')) {
        guidance.push("🆔 Upload your ID for verification purposes");
      }

      if (guidance.length === 0) {
        guidance.push("🎉 Your profile is complete! You're ready to apply for jobs");
      }

      return {
        completion_percentage: status.completion_percentage,
        next_steps: guidance
      };
    } catch (error) {
      logger.error('Failed to get profile guidance', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = ProfileService;