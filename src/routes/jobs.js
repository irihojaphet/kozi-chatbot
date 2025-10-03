// src/routes/jobs.js
const express = require('express');
const { Job, JobApplication } = require('../core/db/models/Job');
const CVGenerationService = require('../services/cvGenerationService');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../core/utils/logger');

const router = express.Router();
const cvService = new CVGenerationService();

/* =========================================================
   External jobs feed (proxy)
   ========================================================= */

const JOBS_API_URL = process.env.JOBS_API_URL || 'https://apis.kozi.rw/admin/select_jobss';
const DEFAULT_CURRENCY = 'RWF';

// Minimal helpers (Node 18+/20+ has global fetch)
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Normalize one raw job from upstream into your internal shape.
 * If the upstream schema differs, adjust these mappings.
 */
function normalizeJob(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const j = {
    id: raw.id ?? raw.job_id ?? raw.ID ?? null,
    title: raw.title ?? raw.job_title ?? raw.position ?? 'Untitled',
    category: raw.category ?? raw.job_category ?? 'General',
    description: raw.description ?? raw.job_description ?? '',
    requirements: raw.requirements ?? raw.requirement ?? '',

    salary_min: numOrNull(raw.salary_min ?? raw.min_salary),
    salary_max: numOrNull(raw.salary_max ?? raw.max_salary),
    salary_currency: raw.salary_currency || DEFAULT_CURRENCY,

    location: raw.location ?? raw.city ?? raw.district ?? raw.area ?? 'Kigali',
    work_type: raw.work_type ?? raw.employment_type ?? 'full-time',

    experience_level: raw.experience_level ?? raw.level ?? 'entry',
    education_level: raw.education_level ?? raw.education ?? null,

    status: (raw.status ?? 'active') || 'active',
    positions_available: intOrNull(raw.positions_available ?? raw.slots ?? 1),
    positions_filled: intOrNull(raw.positions_filled ?? 0),

    posted_date: dateOrNull(raw.posted_date ?? raw.created_at ?? raw.date_posted),
    application_deadline: dateOrNull(raw.application_deadline ?? raw.deadline),
    start_date: dateOrNull(raw.start_date),

    views: intOrNull(raw.views ?? 0),
    applications_count: intOrNull(raw.applications_count ?? 0),
  };

  // require an id
  if (j.id == null) return null;
  return j;
}

async function fetchExternalJobs() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(JOBS_API_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Upstream jobs API error ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    // handle { data: [] } or []
    const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    return list.map(normalizeJob).filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   JOB ROUTES (GETs now proxy external feed)
   ========================================================= */

// GET /api/jobs - Get jobs from external API (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, location, experience_level, work_type, limit, status } = req.query;

    let jobs = await fetchExternalJobs();

    // lightweight filtering
    if (status) {
      const s = String(status).toLowerCase();
      jobs = jobs.filter(j => (j.status || '').toLowerCase() === s);
    } else {
      // default to active if upstream mixes states
      jobs = jobs.filter(j => (j.status || '').toLowerCase() === 'active');
    }
    if (category) {
      const val = String(category).toLowerCase();
      jobs = jobs.filter(j => (j.category || '').toLowerCase() === val);
    }
    if (location) {
      const val = String(location).toLowerCase();
      jobs = jobs.filter(j => (j.location || '').toLowerCase().includes(val));
    }
    if (experience_level) {
      const val = String(experience_level).toLowerCase();
      jobs = jobs.filter(j => (j.experience_level || '').toLowerCase() === val);
    }
    if (work_type) {
      const val = String(work_type).toLowerCase();
      jobs = jobs.filter(j => (j.work_type || '').toLowerCase() === val);
    }

    // sort by posted_date desc if present
    jobs.sort((a, b) => String(b.posted_date || '').localeCompare(String(a.posted_date || '')));

    const lim = Number(limit) || 50;
    const sliced = jobs.slice(0, lim);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        jobs: sliced,
        count: sliced.length
      }
    });
  } catch (error) {
    logger.error('Failed to proxy jobs', { error: error.message });
    res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: 'Failed to retrieve jobs from upstream'
    });
  }
});

// GET /api/jobs/recommended/:user_id - you can still compute recommendations locally,
// but for now we fetch upstream and just slice.
router.get('/recommended/:user_id', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    let jobs = await fetchExternalJobs();

    // TODO: replace with real recommendation logic if/when available
    jobs = jobs.filter(j => (j.status || '').toLowerCase() === 'active')
               .slice(0, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        jobs,
        count: jobs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get recommended jobs (upstream)', { error: error.message });
    res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: 'Failed to retrieve recommended jobs'
    });
  }
});

// GET /api/jobs/:job_id - Get single job details from external API
router.get('/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    const jobs = await fetchExternalJobs();
    const job = jobs.find(j => String(j.id) === String(job_id));

    if (!job) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Job not found'
      });
    }

    // (We can't increment upstream views reliably; skip or implement downstream analytics)
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Failed to get job (upstream)', { error: error.message });
    res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: 'Failed to retrieve job'
    });
  }
});

/* =========================================================
   JOB APPLICATION ROUTES (unchanged - local DB)
   NOTE: These still use your local Job & JobApplication models.
   If you want to apply to EXTERNAL jobs, we must redesign:
   - remove/relax FK constraint, or
   - forward to an upstream "apply" endpoint.
   ========================================================= */

// POST /api/jobs - Create new job (for employers)  — still local
router.post('/', async (req, res) => {
  try {
    const jobData = req.body;

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

// POST /api/jobs/:job_id/apply - Apply to a job (local applications table)
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

    // This check uses LOCAL DB (because job_applications has FK to jobs).
    // If you want to apply to EXTERNAL jobs, see note above.
    const job = await Job.findById(job_id);
    if (!job) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Job not found (local DB)'
      });
    }

    if (job.status !== 'active') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'This job is no longer accepting applications'
      });
    }

    const hasApplied = await JobApplication.hasApplied(user_id, job_id);
    if (hasApplied) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'You have already applied to this job'
      });
    }

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

// GET /api/jobs/applications/user/:user_id - Get user's job applications (local)
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

/* =========================================================
   CV GENERATION ROUTES (unchanged)
   ========================================================= */

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

// GET /api/cv/download/:cv_id - Download CV (placeholder)
router.get('/cv/download/:cv_id', async (req, res) => {
  try {
    const { cv_id } = req.params;

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

// Add this to src/routes/jobs.js temporarily for debugging

// TEST ENDPOINT - Remove after debugging
router.get('/test-external-api', async (req, res) => {
  try {
    const JOBS_API_URL = process.env.JOBS_API_URL || 'https://apis.kozi.rw/admin/select_jobss';
    
    console.log('Testing external API:', JOBS_API_URL);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(JOBS_API_URL, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeout);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `API returned ${response.status}`,
        statusText: response.statusText
      });
    }
    
    const data = await response.json();
    
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Has data property:', !!data?.data);
    console.log('Data keys:', Object.keys(data || {}));
    
    // Show first job as sample
    const jobsArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    console.log('Jobs count:', jobsArray.length);
    
    if (jobsArray.length > 0) {
      console.log('First job sample:', JSON.stringify(jobsArray[0], null, 2));
    }
    
    res.status(200).json({
      success: true,
      debug: {
        url: JOBS_API_URL,
        responseStatus: response.status,
        dataType: typeof data,
        isArray: Array.isArray(data),
        hasDataProperty: !!data?.data,
        jobsCount: jobsArray.length,
        firstJobSample: jobsArray[0] || null,
        allJobs: jobsArray
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
