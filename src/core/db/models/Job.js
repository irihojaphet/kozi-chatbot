// src/core/db/models/Job.js
const { pool } = require('../connection');
const logger = require('../../utils/logger');

class Job {
  static async create(jobData) {
    const {
      employer_id,
      title,
      category,
      description,
      requirements,
      salary_min,
      salary_max,
      location,
      work_type,
      experience_level,
      education_level,
      positions_available,
      posted_date,
      application_deadline,
      start_date
    } = jobData;

    const query = `
      INSERT INTO jobs (
        employer_id, title, category, description, requirements,
        salary_min, salary_max, location, work_type, experience_level,
        education_level, positions_available, posted_date,
        application_deadline, start_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        employer_id, title, category, description, requirements,
        salary_min, salary_max, location, work_type, experience_level,
        education_level, positions_available, posted_date,
        application_deadline, start_date
      ]);
      
      logger.info('Job created', { jobId: result.insertId, title });
      return result.insertId;
    } catch (error) {
      logger.error('Error creating job', { error: error.message });
      throw error;
    }
  }

  static async findById(jobId) {
    const query = 'SELECT * FROM jobs WHERE id = ?';
    
    try {
      const [rows] = await pool.execute(query, [jobId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding job', { error: error.message, jobId });
      throw error;
    }
  }

  static async findActive(filters = {}) {
    let query = `
      SELECT j.*, u.email as employer_email
      FROM jobs j
      LEFT JOIN users u ON j.employer_id = u.id
      WHERE j.status = 'active'
    `;
    
    const params = [];

    if (filters.category) {
      query += ' AND j.category = ?';
      params.push(filters.category);
    }

    if (filters.location) {
      query += ' AND j.location LIKE ?';
      params.push(`%${filters.location}%`);
    }

    if (filters.experience_level) {
      query += ' AND j.experience_level = ?';
      params.push(filters.experience_level);
    }

    if (filters.work_type) {
      query += ' AND j.work_type = ?';
      params.push(filters.work_type);
    }

    // Only show jobs with available positions
    query += ' AND j.positions_available > j.positions_filled';

    // Only show jobs that haven't passed deadline
    query += ' AND (j.application_deadline IS NULL OR j.application_deadline >= CURDATE())';

    query += ' ORDER BY j.posted_date DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    try {
      const [rows] = await pool.execute(query, params);
      logger.info('Active jobs retrieved', { count: rows.length, filters });
      return rows;
    } catch (error) {
      logger.error('Error finding active jobs', { error: error.message });
      throw error;
    }
  }

  static async findRecommended(userId, limit = 10) {
    // Get user profile to match with jobs
    const profileQuery = 'SELECT * FROM profiles WHERE user_id = ?';
    const [profiles] = await pool.execute(profileQuery, [userId]);
    
    if (!profiles.length) {
      return this.findActive({ limit });
    }

    const profile = profiles[0];
    
    const query = `
      SELECT j.*, u.email as employer_email,
        CASE 
          WHEN j.category = ? THEN 3
          WHEN j.experience_level = ? THEN 2
          WHEN j.location LIKE ? THEN 1
          ELSE 0
        END as match_score
      FROM jobs j
      LEFT JOIN users u ON j.employer_id = u.id
      WHERE j.status = 'active'
        AND j.positions_available > j.positions_filled
        AND (j.application_deadline IS NULL OR j.application_deadline >= CURDATE())
      ORDER BY match_score DESC, j.posted_date DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [
        profile.job_category,
        profile.experience_level,
        `%${profile.location}%`,
        limit
      ]);
      
      logger.info('Recommended jobs retrieved', { userId, count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error finding recommended jobs', { error: error.message, userId });
      throw error;
    }
  }

  static async incrementViews(jobId) {
    const query = 'UPDATE jobs SET views = views + 1 WHERE id = ?';
    
    try {
      await pool.execute(query, [jobId]);
    } catch (error) {
      logger.error('Error incrementing job views', { error: error.message, jobId });
    }
  }

  static async incrementApplications(jobId) {
    const query = 'UPDATE jobs SET applications_count = applications_count + 1 WHERE id = ?';
    
    try {
      await pool.execute(query, [jobId]);
    } catch (error) {
      logger.error('Error incrementing applications', { error: error.message, jobId });
    }
  }

  static async updateStatus(jobId, status) {
    const query = 'UPDATE jobs SET status = ? WHERE id = ?';
    
    try {
      await pool.execute(query, [status, jobId]);
      logger.info('Job status updated', { jobId, status });
    } catch (error) {
      logger.error('Error updating job status', { error: error.message, jobId });
      throw error;
    }
  }
}

class JobApplication {
  static async create(applicationData) {
    const { job_id, user_id, cover_letter, cv_file_path } = applicationData;

    const query = `
      INSERT INTO job_applications (job_id, user_id, cover_letter, cv_file_path)
      VALUES (?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        job_id, user_id, cover_letter, cv_file_path
      ]);
      
      // Increment job applications count
      await Job.incrementApplications(job_id);
      
      logger.info('Job application created', { 
        applicationId: result.insertId, 
        jobId: job_id, 
        userId: user_id 
      });
      
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('You have already applied to this job');
      }
      logger.error('Error creating job application', { error: error.message });
      throw error;
    }
  }

  static async findByUserId(userId) {
    const query = `
      SELECT ja.*, j.title, j.category, j.location, j.employer_id
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.user_id = ?
      ORDER BY ja.applied_at DESC
    `;

    try {
      const [rows] = await pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      logger.error('Error finding user applications', { error: error.message, userId });
      throw error;
    }
  }

  static async findByJobId(jobId) {
    const query = `
      SELECT ja.*, p.full_name, p.phone, u.email
      FROM job_applications ja
      JOIN users u ON ja.user_id = u.id
      LEFT JOIN profiles p ON ja.user_id = p.user_id
      WHERE ja.job_id = ?
      ORDER BY ja.applied_at DESC
    `;

    try {
      const [rows] = await pool.execute(query, [jobId]);
      return rows;
    } catch (error) {
      logger.error('Error finding job applications', { error: error.message, jobId });
      throw error;
    }
  }

  static async hasApplied(userId, jobId) {
    const query = 'SELECT id FROM job_applications WHERE user_id = ? AND job_id = ?';
    
    try {
      const [rows] = await pool.execute(query, [userId, jobId]);
      return rows.length > 0;
    } catch (error) {
      logger.error('Error checking application', { error: error.message });
      throw error;
    }
  }

  static async updateStatus(applicationId, status, reviewerId = null) {
    const query = `
      UPDATE job_applications 
      SET status = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ?
    `;

    try {
      await pool.execute(query, [status, reviewerId, applicationId]);
      logger.info('Application status updated', { applicationId, status });
    } catch (error) {
      logger.error('Error updating application status', { error: error.message });
      throw error;
    }
  }
}

module.exports = {
  Job,
  JobApplication
};