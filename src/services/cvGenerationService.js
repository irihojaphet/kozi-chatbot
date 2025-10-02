// src/services/cvGenerationService.js
const { pool } = require('../core/db/connection');
const OpenAIService = require('./openaiService');
const logger = require('../core/utils/logger');

class CVGenerationService {
  constructor() {
    this.openaiService = new OpenAIService();
    
    // CV generation steps
    this.steps = [
      'contact_info',
      'professional_summary',
      'work_experience',
      'education',
      'skills',
      'certifications',
      'languages'
    ];

    // Step prompts for the chatbot
    this.stepPrompts = {
      contact_info: "Let's start creating your professional CV! 📄\n\nFirst, I need your contact information:\n• Full Name\n• Phone Number\n• Email Address\n• Location (City)\n\nPlease provide these details.",
      
      professional_summary: "Great! 👍 Now, let's write your professional summary.\n\nIn 2-3 sentences, tell me:\n• Your current role or profession\n• Your key skills\n• Your career goals\n\nExample: 'Experienced house manager with 5+ years in maintaining clean, organized homes. Skilled in deep cleaning, laundry care, and household organization. Seeking to provide exceptional service to families in Kigali.'",
      
      work_experience: "Perfect! Now let's add your work experience. 💼\n\nFor each job, provide:\n• Job Title\n• Company/Employer Name\n• Dates (e.g., 'Jan 2020 - Present')\n• Key responsibilities and achievements\n\nYou can list multiple jobs, starting with the most recent.",
      
      education: "Excellent work history! Now let's add your education. 🎓\n\nProvide:\n• Highest level of education\n• Institution name\n• Year completed (or expected)\n• Any relevant coursework or honors\n\nExample: 'High School Diploma, Kigali Secondary School, 2018'",
      
      skills: "Great! Now let's list your relevant skills. ⚡\n\nList 5-10 skills related to your job category:\n• Technical skills\n• Soft skills\n• Job-specific abilities\n\nExample: 'Deep cleaning, Laundry & ironing, Time management, Attention to detail, Customer service'",
      
      certifications: "Almost done! Do you have any certifications or training? 📜\n\nIf yes, provide:\n• Certification name\n• Issuing organization\n• Date obtained\n\nIf none, just say 'None' or 'Skip'",
      
      languages: "Final step! What languages do you speak? 🗣️\n\nList languages and proficiency level:\n• Language (Proficiency)\n\nExample: 'Kinyarwanda (Native), English (Fluent), French (Intermediate)'"
    };
  }

  /**
   * Initialize CV generation session for a user
   */
  async startCVGeneration(userId, sessionId) {
    try {
      // Check if user already has a CV in progress
      const existing = await this.getCVGenerationState(sessionId);
      
      if (existing) {
        return {
          message: "I see you already have a CV in progress. Would you like to continue from where you left off, or start fresh?",
          currentStep: existing.current_step,
          hasProgress: true
        };
      }

      // Create new CV generation state
      await this.saveCVGenerationState(sessionId, userId, {
        current_step: 'contact_info',
        completed_steps: [],
        cv_data: {}
      });

      return {
        message: this.stepPrompts.contact_info,
        currentStep: 'contact_info',
        hasProgress: false
      };
    } catch (error) {
      logger.error('Failed to start CV generation', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Process user input for current CV generation step
   */
  async processStep(sessionId, userInput, currentStep) {
    try {
      // Get current state
      const state = await this.getCVGenerationState(sessionId);
      
      if (!state) {
        throw new Error('CV generation session not found');
      }

      // Parse user input using AI
      const parsedData = await this.parseStepInput(currentStep, userInput);
      
      // Save parsed data
      state.cv_data[currentStep] = parsedData;
      state.completed_steps.push(currentStep);

      // Get next step
      const currentStepIndex = this.steps.indexOf(currentStep);
      const nextStep = this.steps[currentStepIndex + 1];

      if (nextStep) {
        // Move to next step
        state.current_step = nextStep;
        await this.saveCVGenerationState(sessionId, state.user_id, state);

        return {
          message: `✅ Got it! Information saved.\n\n${this.stepPrompts[nextStep]}`,
          currentStep: nextStep,
          progress: ((currentStepIndex + 1) / this.steps.length * 100).toFixed(0)
        };
      } else {
        // All steps completed - generate CV
        const cvResult = await this.generateFinalCV(state.user_id, state.cv_data);
        
        return {
          message: `🎉 Congratulations! Your CV has been generated successfully!\n\n${cvResult.summary}\n\nYou can now download it or view it in your profile.`,
          completed: true,
          cvId: cvResult.cvId,
          downloadLink: cvResult.downloadLink
        };
      }
    } catch (error) {
      logger.error('Failed to process CV step', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Parse user input for specific step using AI
   */
  async parseStepInput(step, userInput) {
    const systemPrompts = {
      contact_info: `Extract contact information from the user's message and return a JSON object with:
{
  "full_name": "string",
  "phone": "string",
  "email": "string",
  "location": "string"
}`,
      
      professional_summary: `Create a professional 2-3 sentence summary based on the user's input. Return JSON:
{
  "summary": "professional summary text"
}`,
      
      work_experience: `Extract work experience and return JSON array:
{
  "experiences": [
    {
      "title": "string",
      "company": "string",
      "dates": "string",
      "responsibilities": ["string", "string"]
    }
  ]
}`,
      
      education: `Extract education information and return JSON:
{
  "education": [
    {
      "level": "string",
      "institution": "string",
      "year": "string",
      "details": "string"
    }
  ]
}`,
      
      skills: `Extract skills list and return JSON:
{
  "skills": ["skill1", "skill2", "skill3"]
}`,
      
      certifications: `Extract certifications and return JSON:
{
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string"
    }
  ]
}
If user says "none" or "skip", return empty array.`,
      
      languages: `Extract languages and proficiency levels and return JSON:
{
  "languages": [
    {
      "language": "string",
      "proficiency": "string"
    }
  ]
}`
    };

    try {
      const prompt = systemPrompts[step];
      const response = await this.openaiService.generateResponse(
        [{ sender: 'user', message: userInput }],
        `${prompt}\n\nIMPORTANT: Return ONLY valid JSON, no additional text.`
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      logger.error('Failed to parse step input', { error: error.message, step });
      throw error;
    }
  }

  /**
   * Generate final CV document
   */
  async generateFinalCV(userId, cvData) {
    try {
      // Format CV data into structured format
      const formattedCV = this.formatCVData(cvData);

      // Generate CV content using AI
      const cvContent = await this.generateCVContent(formattedCV);

      // Save CV to database
      const query = `
        INSERT INTO generated_cvs (user_id, cv_data, template_name)
        VALUES (?, ?, ?)
      `;

      const [result] = await pool.execute(query, [
        userId,
        JSON.stringify(formattedCV),
        'professional'
      ]);

      const cvId = result.insertId;

      logger.info('CV generated successfully', { userId, cvId });

      return {
        cvId,
        summary: this.generateCVSummary(formattedCV),
        content: cvContent,
        downloadLink: `/api/cv/download/${cvId}`
      };
    } catch (error) {
      logger.error('Failed to generate final CV', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Format CV data into structured format
   */
  formatCVData(cvData) {
    return {
      contact: cvData.contact_info || {},
      summary: cvData.professional_summary?.summary || '',
      experience: cvData.work_experience?.experiences || [],
      education: cvData.education?.education || [],
      skills: cvData.skills?.skills || [],
      certifications: cvData.certifications?.certifications || [],
      languages: cvData.languages?.languages || []
    };
  }

  /**
   * Generate human-readable CV summary
   */
  generateCVSummary(cvData) {
    const parts = [];
    
    if (cvData.contact?.full_name) {
      parts.push(`📋 CV for ${cvData.contact.full_name}`);
    }
    
    if (cvData.experience?.length > 0) {
      parts.push(`💼 ${cvData.experience.length} work experience entries`);
    }
    
    if (cvData.skills?.length > 0) {
      parts.push(`⚡ ${cvData.skills.length} skills listed`);
    }
    
    return parts.join('\n');
  }

  /**
   * Generate formatted CV content using AI
   */
  async generateCVContent(cvData) {
    const systemPrompt = `You are a professional CV writer. Create a well-formatted, professional CV using the provided data. Use clear sections and professional language.`;

    const userMessage = `Create a professional CV with this information:\n\n${JSON.stringify(cvData, null, 2)}`;

    try {
      const response = await this.openaiService.generateResponse(
        [{ sender: 'user', message: userMessage }],
        systemPrompt
      );

      return response;
    } catch (error) {
      logger.error('Failed to generate CV content', { error: error.message });
      throw error;
    }
  }

  /**
   * Save CV generation state to session context
   */
  async saveCVGenerationState(sessionId, userId, state) {
    const query = `
      UPDATE chat_sessions 
      SET context = JSON_SET(
        COALESCE(context, '{}'),
        '$.cv_generation',
        ?
      )
      WHERE session_id = ?
    `;

    try {
      await pool.execute(query, [
        JSON.stringify({ ...state, user_id: userId }),
        sessionId
      ]);
    } catch (error) {
      logger.error('Failed to save CV generation state', { error: error.message });
      throw error;
    }
  }

  /**
   * Get CV generation state from session
   */
  async getCVGenerationState(sessionId) {
    const query = `
      SELECT JSON_EXTRACT(context, '$.cv_generation') as cv_state
      FROM chat_sessions
      WHERE session_id = ?
    `;

    try {
      const [rows] = await pool.execute(query, [sessionId]);
      
      if (rows.length > 0 && rows[0].cv_state) {
        return JSON.parse(rows[0].cv_state);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get CV generation state', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's generated CVs
   */
  async getUserCVs(userId) {
    const query = `
      SELECT id, template_name, generated_at, is_active
      FROM generated_cvs
      WHERE user_id = ?
      ORDER BY generated_at DESC
    `;

    try {
      const [rows] = await pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      logger.error('Failed to get user CVs', { error: error.message });
      throw error;
    }
  }
}

module.exports = CVGenerationService;