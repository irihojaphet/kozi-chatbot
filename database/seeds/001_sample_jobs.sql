-- Sample jobs for testing
INSERT INTO jobs (employer_id, title, category, description, location, work_type, experience_level, salary_min, salary_max, positions_available, posted_date, status)
VALUES
(1, 'Professional House Cleaner', 'Cleaning', 'Seeking experienced house cleaner for residential properties in Kigali. Must be detail-oriented and professional.', 'Kigali - Kicukiro', 'full-time', 'mid', 80000, 120000, 3, CURDATE(), 'active'),
(1, 'Childcare Specialist', 'Childcare', 'Looking for caring individual to provide childcare services. Experience with children required.', 'Kigali - Gasabo', 'part-time', 'entry', 60000, 80000, 2, CURDATE(), 'active'),
(1, 'Security Guard', 'Security', 'Professional security guard needed for residential complex. Night shifts available.', 'Kigali - Nyarugenge', 'full-time', 'mid', 100000, 140000, 2, CURDATE(), 'active');