// src/routes/jobs.js
const express = require('express');
const { Job, JobApplication } = require('../core/db/models/Job');
const CVGenerationService = require('../services/cvGenerationService');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../core/utils/logger');

const router = express.Router();
const cvService = new CVGenerationService();

// ============ JOB ROUTES ============

// GET /api/jobs - Get all active jobs (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, location, experience_level, work_type, limit } = req.query;

    const jobs = await Job.findActive({
      category,
      location,
      experience_level,
      work_type,
      limit: limit || 50
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        jobs,
        count: jobs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get jobs', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve jobs'
    });
  }
});

// GET /api/jobs/recommended/:user_id - Get recommended jobs for user
router.get('/recommended/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const limit = req.query.limit || 10;

    const jobs = await Job.findRecommended(user_id, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        jobs,
        count: jobs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get recommended jobs', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve recommended jobs'
    });
  }
});

// GET /api/jobs/:job_id - Get single job details
router.get('/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;

    const job = await Job.findById(job_id);

    if (!job) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Increment view count
    await Job.incrementViews(job_id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Failed to get job', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve job'
    });
  }
});

// POST /api/jobs - Create new job (for employers)
router.post('/', async (req, res) => {
  try {
    const jobData = req.body;

    // Validate required fields
    const required = ['employer_id', 'title', 'category', 'description', 'location', 'posted_date'];
    const missing = required.filter(field => !jobData[field]);

    if (missing.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const jobId = await Job.create(jobData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        job_id: jobId,
        message: 'Job created successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to create job', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to create job'
    });
  }
});

// ============ JOB APPLICATION ROUTES ============

// POST /api/jobs/:job_id/apply - Apply to a job
router.post('/:job_id/apply', async (req, res) => {
  try {
    const { job_id } = req.params;
    const { user_id, cover_letter, cv_file_path } = req.body;

    if (!user_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'user_id is required'
      });
    }

    // Check if job exists and is active
    const job = await Job.findById(job_id);
    if (!job) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (job.status !== 'active') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'This job is no longer accepting applications'
      });
    }

    // Check if user already applied
    const hasApplied = await JobApplication.hasApplied(user_id, job_id);
    if (hasApplied) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'You have already applied to this job'
      });
    }

    // Create application
    const applicationId = await JobApplication.create({
      job_id,
      user_id,
      cover_letter,
      cv_file_path
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        application_id: applicationId,
        message: 'Application submitted successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to create job application', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message || 'Failed to submit application'
    });
  }
});

// GET /api/jobs/applications/:user_id - Get user's job applications
router.get('/applications/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const applications = await JobApplication.findByUserId(user_id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        applications,
        count: applications.length
      }
    });
  } catch (error) {
    logger.error('Failed to get user applications', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve applications'
    });
  }
});

// ============ CV GENERATION ROUTES ============

// POST /api/cv/start - Start CV generation
router.post('/cv/start', async (req, res) => {
  try {
    const { user_id, session_id } = req.body;

    if (!user_id || !session_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'user_id and session_id are required'
      });
    }

    const result = await cvService.startCVGeneration(user_id, session_id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to start CV generation', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to start CV generation'
    });
  }
});

// GET /api/cv/user/:user_id - Get user's generated CVs
router.get('/cv/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const cvs = await cvService.getUserCVs(user_id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        cvs,
        count: cvs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get user CVs', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve CVs'
    });
  }
});

// GET /api/cv/download/:cv_id - Download CV
router.get('/cv/download/:cv_id', async (req, res) => {
  try {
    const { cv_id } = req.params;

    // TODO: Implement CV PDF generation and download
    // For now, return placeholder
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'CV download feature coming soon',
      data: {
        cv_id
      }
    });
  } catch (error) {
    logger.error('Failed to download CV', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to download CV'
    });
  }
});

module.exports = router;