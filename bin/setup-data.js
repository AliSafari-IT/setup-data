#!/usr/bin/env node

/**
 * Setup Data CLI
 * 
 * Command-line interface for the setup-data package
 */

const { initCLI } = require('../src/cli');

try {
  // Initialize the CLI
  initCLI();
} catch (error) {
  console.error('Error initializing CLI:', error.message);
  process.exit(1);
}
