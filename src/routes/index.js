const express = require('express');
const chatRoutes = require('./chat');
const profileRoutes = require('./profile');
const healthRoutes = require('./health');

const router = express.Router();

// Mount route modules
router.use('/chat', chatRoutes);
router.use('/profile', profileRoutes);
router.use('/health', healthRoutes);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Kozi Chatbot API',
    version: '1.0.0',
    endpoints: {
      chat: '/api/chat',
      profile: '/api/profile',
      health: '/api/health'
    }
  });
});

module.exports = router;