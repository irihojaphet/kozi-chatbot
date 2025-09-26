require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  
  // AI Services
  OPENAI_API_KEY: Joi.string().required(),
  EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),
  CHAT_MODEL: Joi.string().default('gpt-4o-mini'),
  
  // Vector Storage
  VECTOR_STORE_PATH: Joi.string().default('./data/vectors'),
  
  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error(`❌ Environment validation error: ${error.message}`);
  process.exit(1);
}

module.exports = env;