// src/services/chatService.js - CORRECTED VERSION WITH REAL-TIME JOBS
const { ChatSession } = require('../core/db/models');
const { JobApplication } = require('../core/db/models/Job');
const RAGService = require('./ragService');
const ProfileService = require('./profileService');
const CVGenerationService = require('./cvGenerationService');
const { CHAT_RESPONSES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const logger = require('../core/utils/logger');

// Real-time jobs API configuration
const JOBS_API_URL = process.env.JOBS_API_URL || 'https://apis.kozi.rw/admin/select_jobss';
const DEFAULT_CURRENCY = 'RWF';

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
      await ChatSession.addMessage(sessionId, message, 'user');

      logger.info('chat-inbound', { sessionId, userId, msgPreview: String(message).slice(0, 140) });

      const session = await ChatSession.findBySessionId(sessionId);
      const cvState = session.context?.cv_generation;

      if (cvState && cvState.current_step && !cvState.completed) {
        return await this._handleCVGenerationFlow(sessionId, userId, message, cvState);
      }

      const intent = this._detectIntent(message);

      let responseData;
      switch (intent) {
        case 'jobs':
          responseData = await this._handleJobsIntent(sessionId, userId, message);
          break;
        
        case 'cv_generation':
          responseData = await this._handleCVGenerationIntent(sessionId, userId, message);
          break;
        
        case 'job_application':
          responseData = await this._handleJobApplicationIntent(sessionId, userId, message);
          break;
        
        default:
          responseData = await this._handleGeneralIntent(sessionId, userId, message);
      }

      // Handle response format
      const finalMessage = typeof responseData === 'string' ? responseData : responseData.message;
      await ChatSession.addMessage(sessionId, finalMessage, 'assistant');

      logger.info('chat-outbound', {
        sessionId,
        userId,
        intent,
        msgPreview: finalMessage.slice(0, 140)
      });

      // Return full response data including context for jobs
      if (typeof responseData === 'object') {
        return responseData;
      }

      return { message: finalMessage, intent };
    } catch (error) {
      logger.error('Message processing failed', { error: error.message, sessionId, userId });
      
      const errorResponse = CHAT_RESPONSES.ERROR_GENERIC;
      await ChatSession.addMessage(sessionId, errorResponse, 'assistant');
      
      return { message: errorResponse };
    }
  }

  _detectIntent(message) {
    const text = message.toLowerCase();

    if (
      /\b(create|write|make|generate|build|prepare|need)\s+(a\s+)?(cv|resume|curriculum vitae)\b/.test(text) ||
      /\b(cv|resume)\s+(creation|generation|preparation|help|assistance)\b/.test(text) ||
      /\bhelp.*cv\b/.test(text)
    ) {
      return 'cv_generation';
    }

    if (
      /\b(find|search|look for|show|available|open)\s+(jobs?|positions?|opportunities?|vacancies?)\b/.test(text) ||
      /\bjobs?\s+(available|near me|in|for)\b/.test(text) ||
      /\bwhat\s+jobs?\b/.test(text) ||
      /\bhiring\b/.test(text)
    ) {
      return 'jobs';
    }

    if (
      /\b(apply|applying|application)\s+(for|to)?\s*(job|position)\b/.test(text) ||
      /\bhow.*apply\b/.test(text)
    ) {
      return 'job_application';
    }

    return 'general';
  }

  /**
   * CRITICAL: Fetch jobs from EXTERNAL API, not database
   */
  async _fetchRealtimeJobs(filters = {}) {
    try {
      logger.info('Fetching jobs from external API', { url: JOBS_API_URL, filters });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(JOBS_API_URL, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info('External API response received', { 
        hasData: !!data,
        isArray: Array.isArray(data),
        dataKeys: data ? Object.keys(data) : []
      });

      // Handle different response formats
      const jobsArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      if (jobsArray.length === 0) {
        logger.warn('No jobs returned from external API');
        return [];
      }

      logger.info(`Processing ${jobsArray.length} jobs from external API`);

      // Normalize jobs
      let normalizedJobs = jobsArray
        .map(job => this._normalizeJob(job))
        .filter(Boolean);

      logger.info(`Normalized ${normalizedJobs.length} jobs`);

      // Apply filters
      if (filters.category) {
        const cat = filters.category.toLowerCase();
        normalizedJobs = normalizedJobs.filter(j => 
          (j.category || '').toLowerCase().includes(cat)
        );
      }

      if (filters.location) {
        const loc = filters.location.toLowerCase();
        normalizedJobs = normalizedJobs.filter(j => 
          (j.location || '').toLowerCase().includes(loc)
        );
      }

      if (filters.work_type) {
        const type = filters.work_type.toLowerCase();
        normalizedJobs = normalizedJobs.filter(j => 
          (j.work_type || '').toLowerCase() === type
        );
      }

      // Filter active jobs with available positions
      normalizedJobs = normalizedJobs.filter(j => {
        const isActive = (j.status || '').toLowerCase() === 'active';
        const hasPositions = (j.positions_available || 0) > (j.positions_filled || 0);
        return isActive && hasPositions;
      });

      logger.info(`Final filtered jobs count: ${normalizedJobs.length}`);

      return normalizedJobs;
    } catch (error) {
      logger.error('Failed to fetch external jobs', { 
        error: error.message,
        stack: error.stack,
        url: JOBS_API_URL
      });
      return [];
    }
  }

  _normalizeJob(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const job = {
      id: raw.id ?? raw.job_id ?? raw.ID ?? null,
      title: raw.title ?? raw.job_title ?? raw.position ?? 'Untitled Position',
      category: raw.category ?? raw.job_category ?? raw.type ?? 'General',
      description: raw.description ?? raw.job_description ?? raw.details ?? '',
      requirements: raw.requirements ?? raw.requirement ?? '',
      salary_min: this._parseNumber(raw.salary_min ?? raw.min_salary ?? raw.minSalary),
      salary_max: this._parseNumber(raw.salary_max ?? raw.max_salary ?? raw.maxSalary),
      salary_currency: raw.salary_currency ?? raw.currency ?? DEFAULT_CURRENCY,
      location: raw.location ?? raw.city ?? raw.district ?? raw.area ?? 'Kigali',
      work_type: raw.work_type ?? raw.employment_type ?? raw.type ?? 'full-time',
      experience_level: raw.experience_level ?? raw.level ?? 'entry',
      status: (raw.status ?? 'active').toString().toLowerCase(),
      positions_available: parseInt(raw.positions_available ?? raw.openings ?? raw.slots ?? 1) || 1,
      positions_filled: parseInt(raw.positions_filled ?? raw.filled ?? 0) || 0,
      posted_date: raw.posted_date ?? raw.created_at ?? raw.date_posted ?? new Date().toISOString(),
      application_deadline: raw.application_deadline ?? raw.deadline ?? raw.closing_date
    };

    return job.id ? job : null;
  }

  _parseNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  /**
   * Handle jobs intent - CLEAN FORMATTING (NO EMOJIS/SPECIAL CHARS)
   */
  async _handleJobsIntent(sessionId, userId, message) {
    try {
      const profile = await this.profileService.getProfileStatus(userId);
      const preferences = this._extractJobPreferences(message);
      
      logger.info('Handling jobs intent', { preferences });

      // FETCH FROM EXTERNAL API
      const jobs = await this._fetchRealtimeJobs(preferences);

      if (jobs.length === 0) {
        return {
          message: "I couldn't find any jobs matching your criteria right now.\n\nWould you like me to:\n• Show all available jobs\n• Help you update your profile\n• Search for different job types",
          intent: 'jobs'
        };
      }

      // Format response - CLEAN, NO SPECIAL CHARACTERS
      let response = `I found ${jobs.length} job ${jobs.length === 1 ? 'opportunity' : 'opportunities'} for you!\n\n`;

      jobs.slice(0, 5).forEach((job, index) => {
        const salary = job.salary_min && job.salary_max 
          ? `${this._formatNumber(job.salary_min)} - ${this._formatNumber(job.salary_max)} ${job.salary_currency}`
          : 'Salary negotiable';

        response += `${index + 1}. ${job.title}\n`;
        response += `Location: ${job.location} | Type: ${this._formatWorkType(job.work_type)}\n`;
        response += `Salary: ${salary}\n`;
        response += `Positions available: ${job.positions_available - job.positions_filled}\n`;
        
        if (job.application_deadline) {
          const deadline = new Date(job.application_deadline);
          if (!isNaN(deadline.getTime())) {
            response += `Deadline: ${deadline.toLocaleDateString()}\n`;
          }
        }
        
        response += `\n`;
      });

      if (jobs.length > 5) {
        response += `... and ${jobs.length - 5} more jobs!\n\n`;
      }

      response += `To view details or apply, say: "Show me job number 1" or "Apply to job number 2"\n\n`;
      response += `Your profile is ${profile.completion_percentage}% complete. `;
      response += profile.completion_percentage < 80 
        ? 'Complete it to improve your chances!' 
        : 'Great job!';

      // Save jobs to context
      await ChatSession.updateContext(sessionId, {
        last_jobs: jobs,
        last_jobs_timestamp: Date.now(),
        intent: 'jobs'
      });

      // Return with jobs array for frontend
      return {
        message: response,
        intent: 'jobs',
        context: {
          last_jobs: jobs
        }
      };
    } catch (error) {
      logger.error('Failed to handle jobs intent', { error: error.message, stack: error.stack });
      return {
        message: "I had trouble fetching jobs right now. Please try again in a moment.",
        intent: 'jobs'
      };
    }
  }

  _formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  _formatWorkType(type) {
    const types = {
      'full-time': 'Full-Time',
      'part-time': 'Part-Time',
      'contract': 'Contract',
      'temporary': 'Temporary'
    };
    return types[type] || type;
  }

  async _handleCVGenerationIntent(sessionId, userId, message) {
    try {
      const result = await this.cvService.startCVGeneration(userId, sessionId);

      if (result.hasProgress) {
        const continueIntent = /\b(yes|continue|resume|proceed)\b/i.test(message);
        const startFreshIntent = /\b(no|new|fresh|start over|restart)\b/i.test(message);

        if (continueIntent) {
          return { message: `Great! Let's continue. ${this.cvService.stepPrompts[result.currentStep]}` };
        } else if (startFreshIntent) {
          await this.cvService.saveCVGenerationState(sessionId, userId, {
            current_step: 'contact_info',
            completed_steps: [],
            cv_data: {}
          });
          return { message: this.cvService.stepPrompts.contact_info };
        } else {
          return { message: result.message };
        }
      }

      return { message: result.message };
    } catch (error) {
      logger.error('Failed to handle CV generation intent', { error: error.message });
      return { message: "I had trouble starting CV generation. Please try again." };
    }
  }

  async _handleCVGenerationFlow(sessionId, userId, message, cvState) {
    try {
      if (/\b(cancel|stop|quit|exit)\b/i.test(message)) {
        await ChatSession.updateContext(sessionId, {
          cv_generation: { ...cvState, completed: true }
        });
        return { message: "CV generation cancelled. Your progress has been saved." };
      }

      const result = await this.cvService.processStep(sessionId, message, cvState.current_step);

      if (result.completed) {
        await ChatSession.updateContext(sessionId, {
          cv_generation: { ...cvState, completed: true }
        });
      }

      return { message: result.message };
    } catch (error) {
      logger.error('Failed to handle CV generation flow', { error: error.message });
      return { message: "I had trouble processing that. Could you please rephrase?" };
    }
  }

  async _handleJobApplicationIntent(sessionId, userId, message) {
    try {
      const jobIdMatch = message.match(/job\s*(?:number\s*)?#?(\d+)/i);
      
      if (!jobIdMatch) {
        return { message: "Which job would you like to apply to? Please say 'Apply to job number 1'." };
      }

      const session = await ChatSession.findBySessionId(sessionId);
      const lastJobs = session.context?.last_jobs;

      if (!lastJobs || lastJobs.length === 0) {
        return { message: "I don't see any recent job listings. Please search for jobs first." };
      }

      const jobIndex = parseInt(jobIdMatch[1]) - 1;
      const selectedJob = lastJobs[jobIndex];

      if (!selectedJob) {
        return { message: `I couldn't find job number ${jobIndex + 1}. Please check the number.` };
      }

      const profile = await this.profileService.getProfileStatus(userId);
      
      if (profile.completion_percentage < 60) {
        return { 
          message: `To apply, complete at least 60% of your profile. You're at ${profile.completion_percentage}%.\n\nMissing: ${profile.missing_fields.join(', ')}\n\nShall I help you complete it?` 
        };
      }

      await JobApplication.create({
        job_id: selectedJob.id,
        user_id: userId,
        cover_letter: `Application via Kozi chatbot`,
        cv_file_path: profile.profile_data.cv_file_path
      });

      return { 
        message: `Success! You've applied to "${selectedJob.title}"!\n\nThe employer will review your application and contact you.\n\nTips:\n• Keep your phone handy\n• Complete your profile to 100%\n• Apply to similar jobs\n\nGood luck!` 
      };
    } catch (error) {
      logger.error('Failed to handle job application', { error: error.message });
      return { message: "I had trouble submitting your application. Please try again." };
    }
  }

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

    return { message: response };
  }

  _extractJobPreferences(message) {
    const preferences = {};
    const text = message.toLowerCase();

    const categories = ['cleaning', 'security', 'childcare', 'cooking', 'gardening', 'driver', 'housekeeping'];
    for (const cat of categories) {
      if (text.includes(cat)) {
        preferences.category = cat;
        break;
      }
    }

    const locations = ['kigali', 'nyarugenge', 'gasabo', 'kicukiro', 'musanze', 'huye', 'rubavu'];
    for (const loc of locations) {
      if (text.includes(loc)) {
        preferences.location = loc;
        break;
      }
    }

    if (text.includes('full-time') || text.includes('full time')) {
      preferences.work_type = 'full-time';
    } else if (text.includes('part-time') || text.includes('part time')) {
      preferences.work_type = 'part-time';
    }

    return preferences;
  }

  _extractTopics(message) {
    const topicMap = {
      profile: ['profile', 'complete', 'update'],
      cv: ['cv', 'resume', 'curriculum'],
      jobs: ['job', 'work', 'employment', 'apply'],
      documents: ['upload', 'document', 'id', 'photo'],
      help: ['help', 'support', 'assist']
    };

    const messageWords = String(message || '').toLowerCase().split(/\s+/);
    const detectedTopics = [];

    Object.entries(topicMap).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => messageWords.some(word => word.includes(keyword)))) {
        detectedTopics.push(topic);
      }
    });

    return detectedTopics;
  }

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
      return { message: 'Session ended. Thank you!' };
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