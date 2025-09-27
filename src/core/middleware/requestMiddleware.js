const cors = require('cors');
const helmet = require('helmet');
const express = require('express');
const logger = require('../utils/logger');

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://kozi.rw', 'https://www.kozi.rw']
    : true, // Allow all origins in development (includes Vue on port 5173)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request (with origin for debugging)
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    origin: req.get('Origin') || 'no-origin',
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    
    logger.info('Response sent', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: data?.success !== false
    });
    
    return originalJson.call(this, data);
  };

  next();
};

// Security headers (relaxed for development)
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: process.env.NODE_ENV === 'production' 
        ? ["'self'"] 
        : ["'self'", "http://localhost:5173", "http://localhost:3000"] // Allow Vue and React dev servers
    }
  }
});

const setupMiddleware = (app) => {
  // Security middleware
  app.use(securityMiddleware);
  
  // CORS
  app.use(cors(corsOptions));
  
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Request logging
  app.use(requestLogger);
  
  // Static files (for demo frontend)
  app.use('/demo', express.static('public'));
};

module.exports = setupMiddleware;