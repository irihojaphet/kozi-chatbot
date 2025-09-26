const fs = require('fs').promises;
const path = require('path');
const { OpenAIEmbeddings } = require('@langchain/openai');
const env = require('../config/environment');
const logger = require('../core/utils/logger');

class VectorService {
  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: env.EMBEDDING_MODEL
    });
    this.vectorPath = env.VECTOR_STORE_PATH;
  }

  async initialize() {
    try {
      await fs.mkdir(this.vectorPath, { recursive: true });
      logger.info('Vector store initialized', { path: this.vectorPath });
    } catch (error) {
      logger.error('Failed to initialize vector store', { error: error.message });
      throw error;
    }
  }

  async addDocument(id, text, metadata = {}) {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      const document = {
        id,
        text,
        embedding,
        metadata,
        timestamp: new Date().toISOString()
      };

      const filePath = path.join(this.vectorPath, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(document));
      
      logger.info('Document added to vector store', { id });
      return true;
    } catch (error) {
      logger.error('Failed to add document', { error: error.message, id });
      throw error;
    }
  }

  async search(query, limit = 5) {
    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const documents = await this._loadAllDocuments();
      
      const similarities = documents.map(doc => ({
        ...doc,
        similarity: this._cosineSimilarity(queryEmbedding, doc.embedding)
      }));

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error('Vector search failed', { error: error.message, query });
      throw error;
    }
  }

  async _loadAllDocuments() {
    try {
      const files = await fs.readdir(this.vectorPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const documents = await Promise.all(
        jsonFiles.map(async file => {
          const content = await fs.readFile(path.join(this.vectorPath, file), 'utf8');
          return JSON.parse(content);
        })
      );

      return documents;
    } catch (error) {
      logger.error('Failed to load documents', { error: error.message });
      return [];
    }
  }

  _cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

module.exports = VectorService;