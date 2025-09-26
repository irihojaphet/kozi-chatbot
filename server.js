const express = require('express');
const path = require('path');

// Load environment configuration
const env = require('./src/config/environment');

// Import utilities and middleware
const logger = require('./src/core/utils/logger');
const { testConnection } = require('./src/core/db/connection');
const setupMiddleware = require('./src/core/middleware/requestMiddleware');
const { errorHandler, notFoundHandler } = require('./src/core/middleware/errorHandler');

// Import routes
const apiRoutes = require('./src/routes');

class KoziServer {
  constructor() {
    this.app = express();
    this.port = env.PORT;
  }

  async initialize() {
    try {
      // Setup middleware
      setupMiddleware(this.app);
      
      // Test database connection
      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      // Load knowledge base
      logger.info('Loading Kozi knowledge base...');
      const KnowledgeLoader = require('./src/services/knowledgeLoader');
      const knowledgeLoader = new KnowledgeLoader();
      await knowledgeLoader.loadKoziKnowledge();
      logger.info('Knowledge base loaded successfully');

      // Setup routes
      this.setupRoutes();
      
      // Setup error handling (must be last)
      this.setupErrorHandling();
      
      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Server initialization failed', { error: error.message });
      throw error;
    }
  }

  setupRoutes() {
    // API routes
    this.app.use('/api', apiRoutes);
    
    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Kozi Employee Chatbot API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          chat: '/api/chat',
          profile: '/api/profile'
        },
        demo: '/demo'
      });
    });

    // Demo frontend route
    this.app.get('/demo', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  async start() {
    try {
      await this.initialize();
      
      this.server = this.app.listen(this.port, () => {
        logger.info(`Kozi Chatbot Server running on port ${this.port}`, {
          environment: env.NODE_ENV,
          port: this.port,
          endpoints: {
            api: `http://localhost:${this.port}/api`,
            health: `http://localhost:${this.port}/api/health`,
            demo: `http://localhost:${this.port}/demo`
          }
        });
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      
      if (this.server) {
        this.server.close(() => {
          logger.info('Server closed successfully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new KoziServer();
  server.start();
}

module.exports = KoziServer;