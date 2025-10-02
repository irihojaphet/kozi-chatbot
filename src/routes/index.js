const express = require('express');
const chatRoutes = require('./chat');
const profileRoutes = require('./profile');
const healthRoutes = require('./health');
const jobsRoutes = require('./jobs'); // NEW

const router = express.Router();

router.use('/chat', chatRoutes);
router.use('/profile', profileRoutes);
router.use('/health', healthRoutes);
router.use('/jobs', jobsRoutes); // NEW

router.get('/', (req, res) => {
  res.json({
    message: 'Kozi Chatbot API',
    version: '1.0.0',
    endpoints: {
      chat: '/api/chat',
      profile: '/api/profile',
      health: '/api/health',
      jobs: '/api/jobs' // NEW
    }
  });
});

module.exports = router;