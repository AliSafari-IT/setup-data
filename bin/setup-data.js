#!/usr/bin/env node

/**
 * Setup Data CLI
 * 
 * Command-line interface for the setup-data package
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { setupData } = require('../src/index');
const { logInfo, logSuccess, logError } = require('../src/utils/logger');
const packageJson = require('../package.json');

// Set up the CLI program
program
  .name('setup-data')
  .description('A tool for populating database tables with real or mock data')
  .version(packageJson.version);

// Import command
program
  .command('import')
  .description('Import data from a JSON file to a database table or API endpoint')
  .requiredOption('-f, --file <path>', 'Path to the JSON file containing the data')
  .requiredOption('-t, --table <name>', 'Name of the table or entity to import data into')
  .option('-s, --schema <path>', 'Path to the schema file (C#, TypeScript, or JSON)')
  .option('-c, --config <path>', 'Path to the configuration file (default: ./setup-data.yml)')
  .option('-i, --index <number>', 'Import only the item at the specified index', parseInt)
  .option('--override-category <id>', 'Override all CategoryId values with the specified ID', parseInt)
  .action(async (options) => {
    try {
      logInfo(`Importing data from ${options.file} to ${options.table}...`);
      
      const result = await setupData({
        importFile: options.file,
        tableName: options.table,
        schemaPath: options.schema,
        configPath: options.config,
        index: options.index,
        overrides: options.overrideCategory ? { CategoryId: options.overrideCategory } : undefined
      });
      
      logSuccess(`Import completed successfully!`);
      console.log(result);
    } catch (error) {
      logError(`Import failed: ${error.message}`);
      process.exit(1);
    }
  });

// Generate mock data command
program
  .command('generate')
  .description('Generate mock data based on a schema')
  .requiredOption('-t, --table <name>', 'Name of the table or entity to generate data for')
  .requiredOption('-s, --schema <path>', 'Path to the schema file (C#, TypeScript, or JSON)')
  .option('-n, --count <number>', 'Number of items to generate', parseInt, 10)
  .option('-o, --output <path>', 'Path to save the generated data (if not specified, data will be imported)')
  .option('-c, --config <path>', 'Path to the configuration file (default: ./setup-data.yml)')
  .option('--seed <number>', 'Seed for the random data generator', parseInt)
  .action(async (options) => {
    try {
      logInfo(`Generating ${options.count} mock ${options.table} items based on ${options.schema}...`);
      
      const result = await setupData({
        generateMock: true,
        tableName: options.table,
        schemaPath: options.schema,
        configPath: options.config,
        count: options.count,
        seed: options.seed,
        outputPath: options.output
      });
      
      if (options.output) {
        logSuccess(`Mock data saved to ${options.output}`);
      } else {
        logSuccess(`Mock data generated and imported successfully!`);
        console.log(result);
      }
    } catch (error) {
      logError(`Generation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate data against a schema without importing')
  .requiredOption('-f, --file <path>', 'Path to the JSON file containing the data')
  .requiredOption('-s, --schema <path>', 'Path to the schema file (C#, TypeScript, or JSON)')
  .action(async (options) => {
    try {
      logInfo(`Validating data in ${options.file} against schema ${options.schema}...`);
      
      const { validateSchema } = require('../src/utils/schemaValidator');
      const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
      const isValid = await validateSchema(data, options.schema);
      
      if (isValid) {
        logSuccess('Validation successful! The data matches the schema.');
      } else {
        logError('Validation failed! The data does not match the schema.');
        process.exit(1);
      }
    } catch (error) {
      logError(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Init command to create a configuration file
program
  .command('init')
  .description('Create a new configuration file')
  .option('-p, --path <path>', 'Path to create the configuration file', './setup-data.yml')
  .action((options) => {
    try {
      const examplePath = path.join(__dirname, '..', 'setup-data.yml.example');
      const targetPath = path.resolve(process.cwd(), options.path);
      
      if (fs.existsSync(targetPath)) {
        logError(`Configuration file already exists at ${targetPath}`);
        process.exit(1);
      }
      
      fs.copyFileSync(examplePath, targetPath);
      logSuccess(`Configuration file created at ${targetPath}`);
      logInfo('Edit this file to configure your database connection and other settings.');
    } catch (error) {
      logError(`Failed to create configuration file: ${error.message}`);
      process.exit(1);
    }
  });

// Convert command to convert between case styles
program
  .command('convert')
  .description('Convert property names in a JSON file to a different case style')
  .requiredOption('-f, --file <path>', 'Path to the JSON file to convert')
  .requiredOption('-o, --output <path>', 'Path to save the converted JSON file')
  .requiredOption('-c, --case <style>', 'Case style to convert to (pascal, camel, snake, kebab)')
  .action((options) => {
    try {
      logInfo(`Converting ${options.file} to ${options.case}Case...`);
      
      const { transformData } = require('../src/transformers');
      const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
      
      const transformed = transformData(data, { casing: options.case });
      fs.writeFileSync(options.output, JSON.stringify(transformed, null, 2));
      
      logSuccess(`Converted data saved to ${options.output}`);
    } catch (error) {
      logError(`Conversion failed: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
