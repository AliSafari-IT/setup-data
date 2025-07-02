/**
 * Logger Utility
 * 
 * Provides consistent logging throughout the application
 */

const chalk = require('chalk');

/**
 * Log an informational message
 * @param {string} message Message to log
 */
function logInfo(message) {
  console.log(chalk.blue('ℹ ') + message);
}

/**
 * Log a success message
 * @param {string} message Message to log
 */
function logSuccess(message) {
  console.log(chalk.green('✓ ') + message);
}

/**
 * Log a warning message
 * @param {string} message Message to log
 */
function logWarning(message) {
  console.log(chalk.yellow('⚠ ') + message);
}

/**
 * Log an error message
 * @param {string} message Message to log
 */
function logError(message) {
  console.log(chalk.red('✗ ') + message);
}

/**
 * Log a debug message (only in verbose mode)
 * @param {string} message Message to log
 * @param {boolean} verbose Whether to log in non-verbose mode
 */
function logDebug(message, verbose = false) {
  if (process.env.DEBUG || verbose) {
    console.log(chalk.gray('🔍 ') + message);
  }
}

module.exports = {
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logDebug
};
