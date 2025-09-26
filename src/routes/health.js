const express = require('express');
const { testConnection } = require('../core/db/connection');
const { HTTP_STATUS } = require('../config/constants');

const router = express.Router();

// GET /api/health - Basic health check
router.get('/', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        server: 'running'
      }
    };

    const statusCode = dbConnected ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /api/health/db - Database-specific health check
router.get('/db', async (req, res) => {
  try {
    const connected = await testConnection();
    
    res.status(connected ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;