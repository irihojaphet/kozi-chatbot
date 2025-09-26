const express = require('express');
const { ChatController } = require('../controllers');

const router = express.Router();

// Initialize chat controller once
let chatController;
const initializeController = async () => {
  if (!chatController) {
    chatController = new ChatController();
    await chatController.initialize();
  }
  return chatController;
};

// POST /api/chat/start - Start new chat session
router.post('/start', async (req, res) => {
  try {
    const controller = await initializeController();
    await controller.startSession(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Service initialization failed' });
  }
});

// POST /api/chat/message - Send message to chat
router.post('/message', async (req, res) => {
  try {
    const controller = await initializeController();
    await controller.sendMessage(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Service initialization failed' });
  }
});

// GET /api/chat/history/:session_id - Get chat history
router.get('/history/:session_id', async (req, res) => {
  try {
    const controller = await initializeController();
    await controller.getHistory(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Service initialization failed' });
  }
});

// POST /api/chat/end - End chat session
router.post('/end', async (req, res) => {
  try {
    const controller = await initializeController();
    await controller.endSession(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Service initialization failed' });
  }
});

// GET /api/chat/guidance/:user_id - Get profile guidance
router.get('/guidance/:user_id', async (req, res) => {
  try {
    const controller = await initializeController();
    await controller.getGuidance(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Service initialization failed' });
  }
});

module.exports = router;