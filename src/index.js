/**
 * Setup Data - Main module
 * 
 * A tool for populating database tables with real or mock data
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { importData } = require('./importers');
const { generateMockData } = require('./generators');
const { validateSchema } = require('./utils/schemaValidator');
const { setupDatabase } = require('./adapters/mysql');

/**
 * Main function to setup data
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Results of the operation
 */
async function setupData(options = {}) {
  // Load configuration
  const config = loadConfig(options.configPath);
  
  // Setup database connection if direct DB access is needed
  let dbConnection = null;
  if (config.database && config.database.useDirectConnection) {
    dbConnection = await setupDatabase(config.database);
  }
  
  try {
    // Determine if we're importing or generating data
    if (options.importFile) {
      // Import from file
      const data = JSON.parse(fs.readFileSync(options.importFile, 'utf8'));
      
      // Validate against schema if provided
      if (options.schemaPath) {
        const isValid = await validateSchema(data, options.schemaPath);
        if (!isValid) {
          throw new Error('Data validation failed against the provided schema');
        }
      }
      
      // Import the data
      return await importData({
        data,
        tableName: options.tableName,
        apiConfig: config.api,
        dbConnection,
        transformOptions: config.transform || {}
      });
    } else if (options.generateMock) {
      // Generate mock data
      const mockData = await generateMockData({
        schemaPath: options.schemaPath,
        count: options.count || 10,
        tableName: options.tableName,
        fakerSeed: options.seed
      });
      
      // Import the generated data
      return await importData({
        data: mockData,
        tableName: options.tableName,
        apiConfig: config.api,
        dbConnection,
        transformOptions: config.transform || {}
      });
    } else {
      throw new Error('Either importFile or generateMock option must be provided');
    }
  } finally {
    // Close database connection if it was opened
    if (dbConnection) {
      await dbConnection.end();
    }
  }
}

/**
 * Load configuration from YAML file
 * @param {string} configPath Path to the configuration file
 * @returns {Object} Configuration object
 */
function loadConfig(configPath) {
  const defaultConfigPath = path.resolve(process.cwd(), 'setup-data.yml');
  const filePath = configPath || defaultConfigPath;
  
  try {
    if (fs.existsSync(filePath)) {
      return yaml.load(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
  }
  
  // Return default configuration
  return {
    api: {
      baseUrl: 'http://localhost:5000/api',
      auth: null
    },
    database: {
      useDirectConnection: false
    },
    transform: {
      casing: 'pascal'
    }
  };
}

module.exports = {
  setupData
};
