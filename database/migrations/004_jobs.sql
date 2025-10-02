-- database/migrations/004_jobs.sql

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employer_id INT NOT NULL,

  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,

  salary_min DECIMAL(10,2),
  salary_max DECIMAL(10,2),
  salary_currency VARCHAR(10) DEFAULT 'RWF',

  location VARCHAR(255) NOT NULL,
  work_type ENUM('full-time','part-time','contract','temporary') DEFAULT 'full-time',

  experience_level ENUM('entry','mid','senior') DEFAULT 'entry',
  education_level VARCHAR(100),

  status ENUM('active','filled','closed','draft') DEFAULT 'active',
  positions_available INT DEFAULT 1,
  positions_filled INT DEFAULT 0,

  posted_date DATE NOT NULL,
  application_deadline DATE,
  start_date DATE,

  views INT DEFAULT 0,
  applications_count INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_jobs_employer
    FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE,

  KEY idx_jobs_category (category),
  KEY idx_jobs_status (status),
  KEY idx_jobs_location (location),
  KEY idx_jobs_posted_date (posted_date)
);

-- Job applications
CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  user_id INT NOT NULL,

  cover_letter TEXT,
  cv_file_path VARCHAR(500),
  status ENUM('pending','reviewed','shortlisted','rejected','hired') DEFAULT 'pending',

  screening_notes TEXT,
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,

  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_app_job
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_application (job_id, user_id),
  KEY idx_job_applications_status (status),
  KEY idx_job_applications_user (user_id)
);

-- Generated CVs
CREATE TABLE IF NOT EXISTS generated_cvs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,

  cv_data JSON NOT NULL,
  template_name VARCHAR(100) DEFAULT 'professional',

  pdf_file_path VARCHAR(500),
  docx_file_path VARCHAR(500),

  is_active TINYINT(1) NOT NULL DEFAULT 1,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cvs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
