/**
 * Data Importers
 * 
 * Handles importing data to APIs or databases
 */

const axios = require('axios');
const { transformData } = require('../transformers');
const { insertData } = require('../adapters/mysql');
const { logSuccess, logError } = require('../utils/logger');

/**
 * Import data to API or database
 * @param {Object} options Import options
 * @param {Array<Object>} options.data Data to import
 * @param {string} options.tableName Table/entity name
 * @param {Object} options.apiConfig API configuration
 * @param {Object} options.dbConnection Database connection (optional)
 * @param {Object} options.transformOptions Data transformation options
 * @returns {Promise<Object>} Import results
 */
async function importData({ data, tableName, apiConfig, dbConnection, transformOptions }) {
  // Transform data according to options (e.g., camelCase to PascalCase)
  const transformedData = transformData(data, transformOptions);
  
  // Determine import method based on available connections
  if (dbConnection) {
    return await importToDatabase(dbConnection, tableName, transformedData);
  } else {
    return await importToApi(apiConfig, tableName, transformedData);
  }
}

/**
 * Import data to a database
 * @param {Object} connection Database connection
 * @param {string} tableName Table name
 * @param {Array<Object>} data Data to import
 * @returns {Promise<Object>} Import results
 */
async function importToDatabase(connection, tableName, data) {
  try {
    const result = await insertData(connection, tableName, data);
    logSuccess(`Successfully imported ${result.count} records to ${tableName} table`);
    return {
      success: true,
      method: 'database',
      table: tableName,
      count: result.count,
      details: result
    };
  } catch (error) {
    logError(`Database import failed: ${error.message}`);
    throw error;
  }
}

/**
 * Import data to an API
 * @param {Object} apiConfig API configuration
 * @param {string} entityName Entity name (used for endpoint)
 * @param {Array<Object>} data Data to import
 * @returns {Promise<Object>} Import results
 */
async function importToApi(apiConfig, entityName, data) {
  const baseUrl = apiConfig.baseUrl || 'http://localhost:5000/api';
  const endpoint = `${baseUrl}/${entityName}`;
  
  // Setup authentication if provided
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (apiConfig.auth) {
    if (apiConfig.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${apiConfig.auth.token}`;
    } else if (apiConfig.auth.type === 'basic') {
      const credentials = Buffer.from(`${apiConfig.auth.username}:${apiConfig.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
  }
  
  // Import data with transaction-like behavior (all or nothing)
  const results = [];
  const errors = [];
  
  try {
    for (const item of data) {
      try {
        const response = await axios.post(endpoint, item, { headers });
        results.push({
          success: true,
          id: response.data.id,
          data: response.data
        });
      } catch (error) {
        errors.push({
          item,
          error: error.response ? error.response.data : error.message,
          status: error.response ? error.response.status : null
        });
        
        // If we want all-or-nothing behavior, throw on first error
        if (apiConfig.transactional) {
          throw new Error(`API import failed: ${JSON.stringify(error.response ? error.response.data : error.message)}`);
        }
      }
    }
    
    // If we have any errors but we're not in transactional mode
    if (errors.length > 0) {
      logError(`Completed with ${errors.length} errors out of ${data.length} items`);
    } else {
      logSuccess(`Successfully imported ${results.length} records to ${entityName} API`);
    }
    
    return {
      success: errors.length === 0,
      method: 'api',
      entity: entityName,
      total: data.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  } catch (error) {
    logError(`API import failed: ${error.message}`);
    
    // If we're in transactional mode and have already imported some items,
    // we need to delete them to maintain transactional integrity
    if (apiConfig.transactional && results.length > 0) {
      logError(`Rolling back ${results.length} successful imports...`);
      
      // Attempt to delete each successfully imported item
      for (const result of results) {
        if (result.id) {
          try {
            await axios.delete(`${endpoint}/${result.id}`, { headers });
          } catch (deleteError) {
            logError(`Failed to delete item ${result.id} during rollback`);
          }
        }
      }
    }
    
    throw error;
  }
}

module.exports = {
  importData
};
