CREATE TABLE profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    
    -- Personal Info
    full_name VARCHAR(255),
    phone VARCHAR(20),
    location VARCHAR(255),
    date_of_birth DATE,
    
    -- Professional Info
    job_category VARCHAR(100),
    experience_level ENUM('entry', 'mid', 'senior') DEFAULT 'entry',
    skills JSON,
    work_experience JSON,
    education JSON,
    
    -- Documents
    cv_uploaded BOOLEAN DEFAULT FALSE,
    cv_file_path VARCHAR(500),
    id_uploaded BOOLEAN DEFAULT FALSE,
    id_file_path VARCHAR(500),
    photo_uploaded BOOLEAN DEFAULT FALSE,
    photo_file_path VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_job_category ON profiles(job_category);