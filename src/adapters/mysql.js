/**
 * MySQL Adapter
 * 
 * Handles direct connections to MySQL databases with transaction support
 */

const mysql = require('mysql2/promise');

/**
 * Setup a MySQL database connection
 * @param {Object} config Database configuration
 * @returns {Object} MySQL connection
 */
async function setupDatabase(config) {
  try {
    const connection = await mysql.createConnection({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user || 'root',
      password: config.password || '',
      database: config.database,
      multipleStatements: true
    });
    
    console.log(`Connected to MySQL database: ${config.database}`);
    return connection;
  } catch (error) {
    console.error(`Failed to connect to MySQL database: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a database operation within a transaction
 * @param {Object} connection MySQL connection
 * @param {Function} operation Function that performs database operations
 * @returns {Promise<any>} Result of the operation
 */
async function withTransaction(connection, operation) {
  try {
    await connection.beginTransaction();
    console.log('Transaction started');
    
    const result = await operation(connection);
    
    await connection.commit();
    console.log('Transaction committed successfully');
    
    return result;
  } catch (error) {
    console.error(`Transaction failed: ${error.message}`);
    await connection.rollback();
    console.log('Transaction rolled back');
    throw error;
  }
}

/**
 * Insert data into a MySQL table
 * @param {Object} connection MySQL connection
 * @param {string} tableName Table name
 * @param {Array<Object>} data Array of objects to insert
 * @returns {Promise<Object>} Result of the insert operation
 */
async function insertData(connection, tableName, data) {
  return await withTransaction(connection, async (conn) => {
    const results = [];
    
    for (const item of data) {
      const columns = Object.keys(item);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(col => item[col]);
      
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      const [result] = await conn.execute(query, values);
      results.push({
        id: result.insertId,
        affected: result.affectedRows
      });
    }
    
    return {
      success: true,
      count: results.length,
      results
    };
  });
}

module.exports = {
  setupDatabase,
  withTransaction,
  insertData
};
