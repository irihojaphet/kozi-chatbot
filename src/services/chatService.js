// src/services/chatService.js - REAL-TIME JOBS (AUTH) + existing flows
const { ChatSession } = require('../core/db/models');
const { JobApplication } = require('../core/db/models/Job');
const RAGService = require('./ragService');
const ProfileService = require('./profileService');
const CVGenerationService = require('./cvGenerationService');
const { CHAT_RESPONSES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const logger = require('../core/utils/logger');

// ===== Real-time jobs API configuration =====
const JOBS_API_URL = process.env.JOBS_API_URL || 'https://apis.kozi.rw/admin/select_jobss';
const JOBS_API_LOGIN_URL = process.env.JOBS_API_LOGIN_URL || 'https://apis.kozi.rw/login';
const JOBS_API_EMAIL = process.env.JOBS_API_EMAIL;
const JOBS_API_PASSWORD = process.env.JOBS_API_PASSWORD;
const JOBS_API_ROLE_ID = parseInt(process.env.JOBS_API_ROLE_ID || '1', 10);
const DEFAULT_CURRENCY = 'RWF';

class ChatService {
  constructor() {
    this.ragService = new RAGService();
    this.profileService = new ProfileService();
    this.cvService = new CVGenerationService();

    // Token cache for upstream auth
    this.apiToken = null;
    this.tokenExpiry = null; // ms epoch
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

      // Persist the assistant message (string only)
      const finalMessage = typeof responseData === 'string' ? responseData : responseData.message;
      await ChatSession.addMessage(sessionId, finalMessage, 'assistant');

      logger.info('chat-outbound', {
        sessionId,
        userId,
        intent,
        msgPreview: (finalMessage || '').slice(0, 140)
      });

      // Return full response (including jobs context if present)
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
    const text = String(message || '').toLowerCase();

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

  // ======================================================
  //               UPSTREAM AUTH (token)
  // ======================================================

  /**
   * Get an API token; cache it until near expiry.
   * If credentials are missing, returns null (unauthenticated request).
   */
  async _getAPIToken() {
    // Use cached token if valid (5 min buffer)
    if (this.apiToken && this.tokenExpiry && Date.now() < (this.tokenExpiry - 300000)) {
      logger.info('Using cached API token');
      return this.apiToken;
    }

    // Missing creds? Try unauthenticated
    if (!JOBS_API_EMAIL || !JOBS_API_PASSWORD) {
      logger.warn('JOBS_API_EMAIL or JOBS_API_PASSWORD not set; proceeding without Authorization');
      this.apiToken = null;
      this.tokenExpiry = null;
      return null;
    }

    try {
      logger.info('Logging in to upstream to obtain token...', { loginUrl: JOBS_API_LOGIN_URL });

      const resp = await fetch(JOBS_API_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: JOBS_API_EMAIL,
          password: JOBS_API_PASSWORD,
          role_id: JOBS_API_ROLE_ID
        })
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Login failed ${resp.status}: ${errText.slice(0, 300)}`);
      }

      const data = await resp.json().catch(() => ({}));
      const token = data.token || data.access_token || data.accessToken || null;

      if (!token) throw new Error('No token field found in login response');

      // Default to 1 hour expiry
      this.apiToken = token;
      this.tokenExpiry = Date.now() + (3600 * 1000);

      logger.info('Upstream token acquired', {
        expiresIn: '1h',
        tokenPreview: token ? token.slice(0, 12) + '…' : null
      });

      return token;
    } catch (err) {
      logger.error('Failed to obtain upstream token', { error: err.message });
      // If auth fails, allow unauthenticated attempt (in case endpoint allows public)
      this.apiToken = null;
      this.tokenExpiry = null;
      return null;
    }
  }

  // ======================================================
  //              REAL-TIME JOBS (fetch + normalize)
  // ======================================================

  /**
   * Fetch jobs from EXTERNAL API with auth (when available).
   * Returns an array of normalized jobs, filtered as requested.
   */
  async _fetchRealtimeJobs(filters = {}) {
    const startTime = Date.now();

    try {
      console.log('\n========== JOBS FETCH START ==========');
      console.log('1. API URL:', JOBS_API_URL);
      console.log('2. Filters:', JSON.stringify(filters));

      // Acquire/refresh token if configured
      const token = await this._getAPIToken();
      console.log('3. Token obtained:', !!token);

      logger.info('Fetching jobs from external API', { url: JOBS_API_URL, filters });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      console.log('4. Sending authenticated request...');
      const resp = await fetch(JOBS_API_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Kozi-Platform/1.0',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      clearTimeout(timeout);
      console.log('5. Response received:', resp.status, resp.statusText);

      // Expired token → refresh once and retry
      if (resp.status === 401 && token) {
        console.log('6. Token possibly expired; refreshing…');
        this.apiToken = null;
        this.tokenExpiry = null;

        const fresh = await this._getAPIToken();
        const retry = await fetch(JOBS_API_URL, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Kozi-Platform/1.0',
            ...(fresh ? { Authorization: `Bearer ${fresh}` } : {})
          }
        });

        if (!retry.ok) {
          const t = await retry.text().catch(() => '');
          throw new Error(`API authentication failed after retry: ${retry.status} ${retry.statusText} ${t.slice(0, 200)}`);
        }

        const retraw = await retry.json().catch(() => ({}));
        console.log('7. Retry successful');
        return this._processJobsResponse(retraw, filters, startTime);
      }

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        console.error('6. API ERROR Response:', errorText);
        throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
      }

      const raw = await resp.json().catch(() => ({}));
      return this._processJobsResponse(raw, filters, startTime);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n❌ JOBS FETCH FAILED:', error.message);
      console.error('Stack:', error.stack);
      console.error(`Duration: ${duration}ms`);
      console.error('========== JOBS FETCH END ==========\n');

      logger.error('Failed to fetch external jobs', {
        error: error.message,
        stack: error.stack,
        url: JOBS_API_URL,
        duration: `${duration}ms`
      });

      return [];
    }
  }

  /**
   * Handle variations in upstream response; normalize + filter; log timing.
   */
  _processJobsResponse(rawData, filters, startTime) {
    console.log('6. Raw data type:', typeof rawData);
    console.log('7. Is array?', Array.isArray(rawData));
    console.log('8. Has .data property?', !!rawData?.data);

    // Accept either [] or { data: [] }
    const jobsArray = Array.isArray(rawData)
      ? rawData
      : (Array.isArray(rawData?.data) ? rawData.data : []);

    console.log('9. Jobs array length:', jobsArray.length);

    if (jobsArray.length === 0) {
      console.log('10. ❌ NO JOBS in response!');
      logger.warn('No jobs returned from external API');
      return [];
    }

    console.log('11. First job sample:', JSON.stringify(jobsArray[0], null, 2));

    // Normalize
    let normalizedJobs = [];
    for (let i = 0; i < jobsArray.length; i++) {
      const normalized = this._normalizeJob(jobsArray[i]);
      if (normalized) normalizedJobs.push(normalized);
    }

    console.log(`12. After normalization: ${normalizedJobs.length}/${jobsArray.length} jobs`);

    if (normalizedJobs.length === 0) {
      console.log('13. ❌ ALL JOBS FAILED NORMALIZATION!');
      return [];
    }

    // Apply optional filters
    const before = normalizedJobs.length;

    if (filters.category) {
      const cat = String(filters.category).toLowerCase();
      normalizedJobs = normalizedJobs.filter(j => (j.category || '').toLowerCase().includes(cat));
    }
    if (filters.location) {
      const loc = String(filters.location).toLowerCase();
      normalizedJobs = normalizedJobs.filter(j => (j.location || '').toLowerCase().includes(loc));
    }
    if (filters.work_type) {
      const type = String(filters.work_type).toLowerCase();
      normalizedJobs = normalizedJobs.filter(j => (j.work_type || '').toLowerCase() === type);
    }

    // Filter out clearly inactive/closed items; allow missing position fields
    normalizedJobs = normalizedJobs.filter(j => {
      const status = (j.status || 'active').toLowerCase();
      if (['inactive', 'closed', 'expired', 'deleted'].includes(status)) return false;

      if (!j.positions_available) return true;
      const filled = j.positions_filled || 0;
      return j.positions_available > filled;
    });

    console.log(`14. After filters: ${normalizedJobs.length} jobs (filtered out: ${before - normalizedJobs.length})`);

    const duration = Date.now() - startTime;
    console.log(`\n15. ✅ FINAL RESULT: ${normalizedJobs.length} jobs (${duration}ms)`);
    console.log('========== JOBS FETCH END ==========\n');

    logger.info('Jobs fetch completed', {
      total: jobsArray.length,
      normalized: normalizedJobs.length,
      duration: `${duration}ms`
    });

    return normalizedJobs;
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
      education_level: raw.education_level ?? raw.education ?? null,

      status: (raw.status ?? 'active').toString().toLowerCase(),
      positions_available: parseInt(raw.positions_available ?? raw.openings ?? raw.slots ?? 1, 10) || 1,
      positions_filled: parseInt(raw.positions_filled ?? raw.filled ?? 0, 10) || 0,

      posted_date: raw.posted_date ?? raw.created_at ?? raw.date_posted ?? new Date().toISOString(),
      application_deadline: raw.application_deadline ?? raw.deadline ?? raw.closing_date,
      start_date: raw.start_date ?? null,

      views: parseInt(raw.views ?? 0, 10) || 0,
      applications_count: parseInt(raw.applications_count ?? 0, 10) || 0
    };

    return job.id ? job : null;
  }

  _parseNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  // ======================================================
  //                 INTENTS / RESPONSES
  // ======================================================

  /**
   * Jobs intent → fetch upstream → return message + jobs for UI
   */
  async _handleJobsIntent(sessionId, userId, message) {
    try {
      const profile = await this.profileService.getProfileStatus(userId);
      const preferences = this._extractJobPreferences(message);

      logger.info('Handling jobs intent', { preferences });

      const jobs = await this._fetchRealtimeJobs(preferences);

      if (jobs.length === 0) {
        return {
          message:
            "I couldn't find any jobs matching your criteria right now.\n\n" +
            "Would you like me to:\n" +
            "• Show all available jobs\n" +
            "• Help you update your profile\n" +
            "• Search for different job types",
          intent: 'jobs'
        };
      }

      // Clean, concise text list (first 5)
      let response = `I found ${jobs.length} job ${jobs.length === 1 ? 'opportunity' : 'opportunities'} for you!\n\n`;
      jobs.slice(0, 5).forEach((job, index) => {
        const salary = (job.salary_min && job.salary_max)
          ? `${this._formatNumber(job.salary_min)} - ${this._formatNumber(job.salary_max)} ${job.salary_currency}`
          : 'Salary negotiable';

        response += `${index + 1}. ${job.title}\n`;
        response += `Location: ${job.location} | Type: ${this._formatWorkType(job.work_type)}\n`;
        response += `Salary: ${salary}\n`;
        const remaining = (job.positions_available || 0) - (job.positions_filled || 0);
        response += `Positions available: ${remaining >= 0 ? remaining : 0}\n`;
        if (job.application_deadline) {
          const d = new Date(job.application_deadline);
          if (!isNaN(d.getTime())) response += `Deadline: ${d.toLocaleDateString()}\n`;
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

      // Save jobs to session context (for UI JobCard + subsequent "apply" by index)
      await ChatSession.updateContext(sessionId, {
        last_jobs: jobs,
        last_jobs_timestamp: Date.now(),
        intent: 'jobs'
      });

      return {
        message: response,
        intent: 'jobs',
        context: { last_jobs: jobs }
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
      contract: 'Contract',
      temporary: 'Temporary'
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

      const jobIndex = parseInt(jobIdMatch[1], 10) - 1;
      const selectedJob = lastJobs[jobIndex];

      if (!selectedJob) {
        return { message: `I couldn't find job number ${jobIndex + 1}. Please check the number.` };
      }

      const profile = await this.profileService.getProfileStatus(userId);

      if (profile.completion_percentage < 60) {
        return {
          message:
            `To apply, complete at least 60% of your profile. You're at ${profile.completion_percentage}%.\n\n` +
            `Missing: ${profile.missing_fields.join(', ')}\n\n` +
            `Shall I help you complete it?`
        };
      }

      // Local application record (your DB)
      await JobApplication.create({
        job_id: selectedJob.id,
        user_id: userId,
        cover_letter: 'Application via Kozi chatbot',
        cv_file_path: profile.profile_data?.cv_file_path || null
      });

      return {
        message:
          `Success! You've applied to "${selectedJob.title}"!\n\n` +
          `The employer will review your application and contact you.\n\n` +
          `Tips:\n` +
          `• Keep your phone handy\n` +
          `• Complete your profile to 100%\n` +
          `• Apply to similar jobs\n\n` +
          `Good luck!`
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
    const text = String(message || '').toLowerCase();

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
