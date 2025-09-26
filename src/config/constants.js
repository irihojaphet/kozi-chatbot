// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Bot Types
const BOT_TYPES = {
  EMPLOYEE: 'employee',
  EMPLOYER: 'employer',
  HOMEPAGE: 'homepage',
  ADMIN: 'admin'
};

// User Types
const USER_TYPES = {
  EMPLOYEE: 'employee',
  EMPLOYER: 'employer'
};

// Experience Levels
const EXPERIENCE_LEVELS = {
  ENTRY: 'entry',
  MID: 'mid',
  SENIOR: 'senior'
};

// Chat Response Templates
const CHAT_RESPONSES = {
  WELCOME: "Hello 👋 Welcome back to your Kozi dashboard! I can help you complete your profile, apply for jobs, or even prepare a professional CV. What would you like to do first?",
  REDIRECT_SUPPORT: "Please contact our Support Team 📧 support@kozi.rw | ☎ +250 788 123 456.",
  ERROR_GENERIC: "I encountered an issue. Please try again or contact support if the problem persists.",
  PROFILE_MOTIVATION: "✨ Every completed profile and polished CV gives you more visibility with employers. Let's finish yours today!"
};

// File Upload Limits
const UPLOAD_LIMITS = {
  CV_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ID_MAX_SIZE: 2 * 1024 * 1024, // 2MB  
  PHOTO_MAX_SIZE: 1 * 1024 * 1024, // 1MB
  ALLOWED_CV_TYPES: ['pdf', 'doc', 'docx'],
  ALLOWED_ID_TYPES: ['jpg', 'jpeg', 'png', 'pdf'],
  ALLOWED_PHOTO_TYPES: ['jpg', 'jpeg', 'png']
};

module.exports = {
  HTTP_STATUS,
  BOT_TYPES,
  USER_TYPES,
  EXPERIENCE_LEVELS,
  CHAT_RESPONSES,
  UPLOAD_LIMITS
};