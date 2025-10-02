// src/services/chatService.js - ENHANCED VERSION
const { ChatSession } = require('../core/db/models');
const { Job, JobApplication } = require('../core/db/models/Job');
const RAGService = require('./ragService');
const ProfileService = require('./profileService');
const CVGenerationService = require('./cvGenerationService');
const { CHAT_RESPONSES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const logger = require('../core/utils/logger');

class ChatService {
  constructor() {
    this.ragService = new RAGService();
    this.profileService = new ProfileService();
    this.cvService = new CVGenerationService();
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

      logger.info('chat-inbound', { sessionId, userId, msgPreview: String(message).slice(0, 140) });

      // Check conversation context - are we in CV generation mode?
      const session = await ChatSession.findBySessionId(sessionId);
      const cvState = session.context?.cv_generation;

      if (cvState && cvState.current_step && !cvState.completed) {
        // User is in CV generation flow
        return await this._handleCVGenerationFlow(sessionId, userId, message, cvState);
      }

      // Detect user intent
      const intent = this._detectIntent(message);

      let response;
      switch (intent) {
        case 'jobs':
          response = await this._handleJobsIntent(sessionId, userId, message);
          break;
        
        case 'cv_generation':
          response = await this._handleCVGenerationIntent(sessionId, userId, message);
          break;
        
        case 'job_application':
          response = await this._handleJobApplicationIntent(sessionId, userId, message);
          break;
        
        default:
          // Default RAG-based response
          response = await this._handleGeneralIntent(sessionId, userId, message);
      }

      // Add assistant response to session
      await ChatSession.addMessage(sessionId, response, 'assistant');

      logger.info('chat-outbound', {
        sessionId,
        userId,
        intent,
        msgPreview: response.slice(0, 140)
      });

      return { message: response, intent };
    } catch (error) {
      logger.error('Message processing failed', { error: error.message, sessionId, userId });
      
      const errorResponse = CHAT_RESPONSES.ERROR_GENERIC;
      await ChatSession.addMessage(sessionId, errorResponse, 'assistant');
      
      return { message: errorResponse };
    }
  }

  /**
   * Detect user intent from message
   */
  _detectIntent(message) {
    const text = message.toLowerCase();

    // CV Generation intent
    if (
      /\b(create|write|make|generate|build|prepare|need)\s+(a\s+)?(cv|resume|curriculum vitae)\b/.test(text) ||
      /\b(cv|resume)\s+(creation|generation|preparation|help|assistance)\b/.test(text) ||
      /\bhelp.*cv\b/.test(text)
    ) {
      return 'cv_generation';
    }

    // Job search intent
    if (
      /\b(find|search|look for|show|available|open)\s+(jobs?|positions?|opportunities?|vacancies?)\b/.test(text) ||
      /\bjobs?\s+(available|near me|in|for)\b/.test(text) ||
      /\bwhat\s+jobs?\b/.test(text) ||
      /\bhiring\b/.test(text)
    ) {
      return 'jobs';
    }

    // Job application intent
    if (
      /\b(apply|applying|application)\s+(for|to)?\s*(job|position)\b/.test(text) ||
      /\bhow.*apply\b/.test(text)
    ) {
      return 'job_application';
    }

    return 'general';
  }

  /**
   * Handle jobs-related queries
   */
  async _handleJobsIntent(sessionId, userId, message) {
    try {
      // Get user profile for personalized recommendations
      const profile = await this.profileService.getProfileStatus(userId);

      // Extract job preferences from message
      const preferences = this._extractJobPreferences(message);

      // Get jobs (recommended if no specific filters, otherwise filtered)
      let jobs;
      if (Object.keys(preferences).length > 0) {
        jobs = await Job.findActive({ ...preferences, limit: 10 });
      } else {
        jobs = await Job.findRecommended(userId, 10);
      }

      if (jobs.length === 0) {
        return "I couldn't find any jobs matching your criteria right now. 😕\n\nWould you like me to:\n• Show all available jobs\n• Help you update your profile to increase job matches\n• Set up job alerts for your preferences";
      }

      // Format jobs response
      let response = `🎯 I found ${jobs.length} job ${jobs.length === 1 ? 'opportunity' : 'opportunities'} for you!\n\n`;

      jobs.slice(0, 5).forEach((job, index) => {
        const salary = job.salary_min && job.salary_max 
          ? `💰 ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} ${job.salary_currency}`
          : '💰 Salary negotiable';

        response += `**${index + 1}. ${job.title}**\n`;
        response += `📍 ${job.location} | 💼 ${job.work_type}\n`;
        response += `${salary}\n`;
        response += `👥 ${job.positions_available - job.positions_filled} positions available\n`;
        
        if (job.application_deadline) {
          response += `⏰ Deadline: ${new Date(job.application_deadline).toLocaleDateString()}\n`;
        }
        
        response += `\n`;
      });

      if (jobs.length > 5) {
        response += `\n... and ${jobs.length - 5} more jobs!\n`;
      }

      response += `\n✨ To view full details or apply, say: "Show me job #1" or "Apply to job #2"\n`;
      response += `\nYour profile is ${profile.completion_percentage}% complete. ${profile.completion_percentage < 80 ? 'Complete it to improve your chances! 🚀' : 'Great job! 🎉'}`;

      // Save jobs to session context for reference
      await ChatSession.updateContext(sessionId, {
        last_jobs: jobs.map(j => ({ id: j.id, title: j.title })),
        last_jobs_timestamp: Date.now()
      });

      return response;
    } catch (error) {
      logger.error('Failed to handle jobs intent', { error: error.message });
      return "I had trouble fetching jobs right now. Please try again in a moment.";
    }
  }

  /**
   * Handle CV generation intent
   */
  async _handleCVGenerationIntent(sessionId, userId, message) {
    try {
      const result = await this.cvService.startCVGeneration(userId, sessionId);

      if (result.hasProgress) {
        // User has CV in progress
        const continueIntent = /\b(yes|continue|resume|proceed)\b/i.test(message);
        const startFreshIntent = /\b(no|new|fresh|start over|restart)\b/i.test(message);

        if (continueIntent) {
          return `Great! Let's continue. ${this.cvService.stepPrompts[result.currentStep]}`;
        } else if (startFreshIntent) {
          // Reset CV generation
          await this.cvService.saveCVGenerationState(sessionId, userId, {
            current_step: 'contact_info',
            completed_steps: [],
            cv_data: {}
          });
          return this.cvService.stepPrompts.contact_info;
        } else {
          return result.message;
        }
      }

      return result.message;
    } catch (error) {
      logger.error('Failed to handle CV generation intent', { error: error.message });
      return "I had trouble starting CV generation. Please try again.";
    }
  }

  /**
   * Handle CV generation flow (user is actively building CV)
   */
  async _handleCVGenerationFlow(sessionId, userId, message, cvState) {
    try {
      // Check if user wants to cancel
      if (/\b(cancel|stop|quit|exit)\b/i.test(message)) {
        await ChatSession.updateContext(sessionId, {
          cv_generation: { ...cvState, completed: true }
        });
        return "CV generation cancelled. Your progress has been saved. You can resume anytime by saying 'create my CV'.";
      }

      // Process current step
      const result = await this.cvService.processStep(
        sessionId,
        message,
        cvState.current_step
      );

      if (result.completed) {
        // Mark CV generation as completed
        await ChatSession.updateContext(sessionId, {
          cv_generation: { ...cvState, completed: true }
        });
      }

      return result.message;
    } catch (error) {
      logger.error('Failed to handle CV generation flow', { error: error.message });
      return "I had trouble processing that information. Could you please rephrase or provide the information again?";
    }
  }

  /**
   * Handle job application intent
   */
  async _handleJobApplicationIntent(sessionId, userId, message) {
    try {
      // Extract job ID from message if specified
      const jobIdMatch = message.match(/job\s*#?(\d+)/i);
      
      if (!jobIdMatch) {
        return "Which job would you like to apply to? Please say 'Apply to job #1' or specify the job number from the list I showed you.";
      }

      // Get job from context
      const session = await ChatSession.findBySessionId(sessionId);
      const lastJobs = session.context?.last_jobs;

      if (!lastJobs || lastJobs.length === 0) {
        return "I don't see any recent job listings. Please search for jobs first by saying 'Show me available jobs'.";
      }

      const jobIndex = parseInt(jobIdMatch[1]) - 1;
      const selectedJob = lastJobs[jobIndex];

      if (!selectedJob) {
        return `I couldn't find job #${jobIndex + 1}. Please check the job number and try again.`;
      }

      // Check if user has already applied
      const hasApplied = await JobApplication.hasApplied(userId, selectedJob.id);
      
      if (hasApplied) {
        return `You've already applied to "${selectedJob.title}". I'll notify you when the employer reviews your application! 🎉`;
      }

      // Check profile completion
      const profile = await this.profileService.getProfileStatus(userId);
      
      if (profile.completion_percentage < 60) {
        return `To apply for jobs, you need to complete at least 60% of your profile. You're currently at ${profile.completion_percentage}%.\n\n❌ Missing: ${profile.missing_fields.join(', ')}\n\nWould you like me to help you complete your profile first?`;
      }

      // Create application
      await JobApplication.create({
        job_id: selectedJob.id,
        user_id: userId,
        cover_letter: `Application submitted via Kozi chatbot`,
        cv_file_path: profile.profile_data.cv_file_path
      });

      return `🎉 Success! You've applied to "${selectedJob.title}"!\n\nYour application has been submitted to the employer. They'll review it and contact you if you're a good match.\n\n✨ Tips while you wait:\n• Keep your phone handy\n• Complete your profile to 100%\n• Apply to similar jobs to increase your chances\n\nGood luck! 🍀`;
    } catch (error) {
      logger.error('Failed to handle job application', { error: error.message });
      return "I had trouble submitting your application. Please try again or contact support.";
    }
  }

  /**
   * Handle general intent (existing RAG logic)
   */
  async _handleGeneralIntent(sessionId, userId, message) {
    const profileStatus = await this.profileService.getProfileStatus(userId);
    const session = await ChatSession.findBySessionId(sessionId);
    const recentMessages = session.messages.slice(-10);

    const response = await this.ragService.generateContextualResponse(
      message,
      recentMessages,
      {
        profileCompletion: profileStatus.completion_percentage,
        missingFields: profileStatus.missing_fields
      }
    );

    await ChatSession.updateContext(sessionId, {
      last_profile_completion: profileStatus.completion_percentage,
      topics_discussed: this._extractTopics(message)
    });

    return response;
  }

  /**
   * Extract job preferences from message
   */
  _extractJobPreferences(message) {
    const preferences = {};
    const text = message.toLowerCase();

    // Extract category
    const categories = ['cleaning', 'security', 'childcare', 'cooking', 'gardening', 'driver'];
    for (const cat of categories) {
      if (text.includes(cat)) {
        preferences.category = cat;
        break;
      }
    }

    // Extract location
    const locations = ['kigali', 'nyarugenge', 'gasabo', 'kicukiro'];
    for (const loc of locations) {
      if (text.includes(loc)) {
        preferences.location = loc;
        break;
      }
    }

    // Extract work type
    if (text.includes('full-time') || text.includes('full time')) {
      preferences.work_type = 'full-time';
    } else if (text.includes('part-time') || text.includes('part time')) {
      preferences.work_type = 'part-time';
    }

    return preferences;
  }

  _extractTopics(message) {
    const topicMap = {
      profile: ['profile', 'complete', 'update', 'information'],
      cv: ['cv', 'resume', 'curriculum'],
      jobs: ['job', 'work', 'employment', 'apply', 'application', 'hiring'],
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

  // Existing methods remain...
  async getSessionHistory(sessionId) {
    try {
      const session = await ChatSession.findBySessionId(sessionId);
      if (!session) throw new Error('Chat session not found');

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
}

module.exports = ChatService;