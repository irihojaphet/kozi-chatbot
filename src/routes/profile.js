const express = require('express');
const { ProfileController } = require('../controllers');

const router = express.Router();
const profileController = new ProfileController();

// POST /api/profile/user - Create new user
router.post('/user', async (req, res) => {
  await profileController.createUser(req, res);
});

// GET /api/profile/user/:email - Get user by email
router.get('/user/:email', async (req, res) => {
  await profileController.getUserByEmail(req, res);
});

// GET /api/profile/:user_id - Get user profile
router.get('/:user_id', async (req, res) => {
  await profileController.getProfile(req, res);
});

// PUT /api/profile/:user_id - Update user profile
router.put('/:user_id', async (req, res) => {
  await profileController.updateProfile(req, res);
});

// POST /api/profile/:user_id/document - Upload document
router.post('/:user_id/document', async (req, res) => {
  await profileController.uploadDocument(req, res);
});

// GET /api/profile/:user_id/guidance - Get profile completion guidance
router.get('/:user_id/guidance', async (req, res) => {
  await profileController.getGuidance(req, res);
});

module.exports = router;