/**
 * Simplified CLI module for setup-data
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const packageJson = require('../package.json');

// Simple logger functions
const logger = {
  info: (message) => console.log(chalk.blue('ℹ ') + message),
  success: (message) => console.log(chalk.green('✓ ') + message),
  warning: (message) => console.log(chalk.yellow('⚠ ') + message),
  error: (message) => console.log(chalk.red('✗ ') + message)
};

/**
 * Initialize the CLI
 */
function initCLI() {
  // Set up the CLI program
  program
    .name('setup-data')
    .description('A tool for populating database tables with real or mock data')
    .version(packageJson.version);

  // Init command
  program
    .command('init')
    .description('Create a new configuration file')
    .option('-p, --path <path>', 'Path to create the configuration file', './setup-data.yml')
    .action((options) => {
      try {
        const examplePath = path.join(__dirname, '..', 'setup-data.yml.example');
        const targetPath = path.resolve(process.cwd(), options.path);
        
        if (fs.existsSync(targetPath)) {
          logger.error(`Configuration file already exists at ${targetPath}`);
          process.exit(1);
        }
        
        fs.copyFileSync(examplePath, targetPath);
        logger.success(`Configuration file created at ${targetPath}`);
        logger.info('Edit this file to configure your database connection and other settings.');
      } catch (error) {
        logger.error(`Failed to create configuration file: ${error.message}`);
        process.exit(1);
      }
    });

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
        logger.info(`Importing data from ${options.file} to ${options.table}...`);
        
        const yaml = require('js-yaml');
        const configPath = options.config || './setup-data.yml';
        let config = {};
        
        try {
          config = yaml.load(fs.readFileSync(configPath, 'utf8'));
          logger.info(`Loaded configuration from ${configPath}`);
        } catch (err) {
          logger.warning(`Could not load config file: ${err.message}. Using default settings.`);
        }
        
        const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        
        // Validate against schema if provided
        if (options.schema) {
          const { validateSchema } = require('./utils/schemaValidator');
          logger.info(`Validating data against schema ${options.schema}...`);
          const isValid = await validateSchema(data, options.schema);
          
          if (!isValid) {
            logger.error('Data validation failed against the provided schema');
            process.exit(1);
          }
          logger.success('Data validation successful');
        }
        
        // Import the data
        if (config.database && config.database.useDirectConnection) {
          const mysql = require('mysql2/promise');
          logger.info(`Connecting to database ${config.database.database} on ${config.database.host}...`);
          
          const connection = await mysql.createConnection({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database
          });
          
          try {
            // Start transaction if configured
            if (config.database.transactional !== false) {
              await connection.query('START TRANSACTION');
              logger.info('Started database transaction');
            }
            
            // Process data items
            const dataToImport = options.index !== undefined ? [data[options.index]] : data;
            let successCount = 0;
            
            for (const item of dataToImport) {
              // Apply overrides if specified
              if (options.overrideCategory) {
                item.CategoryId = options.overrideCategory;
              }
              
              // Add default values for required fields if missing
              const defaultValues = {
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                CostPrice: item.Price ? item.Price * 0.6 : 0,
                StockQuantity: 100,
                MinStockLevel: 10,
                MaxStockLevel: 1000,
                RequiresPrescription: false,
                Manufacturer: item.Manufacturer || 'Default Manufacturer',
                BatchNumber: item.BatchNumber || 'DEFAULT-BATCH',
              };
              
              // Merge item with default values for missing fields
              const enrichedItem = { ...defaultValues, ...item };
              
              // Extract fields and values
              const fields = Object.keys(enrichedItem);
              const values = Object.values(enrichedItem);
              const placeholders = fields.map(() => '?').join(', ');
              
              const query = `INSERT INTO ${options.table} (${fields.join(', ')}) VALUES (${placeholders})`;
              
              try {
                const [result] = await connection.query(query, values);
                successCount++;
              } catch (err) {
                logger.error(`Error inserting item: ${err.message}`);
                if (config.database.transactional !== false) {
                  await connection.query('ROLLBACK');
                  logger.info('Transaction rolled back due to error');
                  process.exit(1);
                }
              }
            }
            
            // Commit transaction if configured
            if (config.database.transactional !== false) {
              await connection.query('COMMIT');
              logger.info('Transaction committed successfully');
            }
            
            logger.success(`Successfully imported ${successCount} of ${dataToImport.length} items to ${options.table}`);
          } finally {
            await connection.end();
          }
        } else if (config.api) {
          const axios = require('axios');
          logger.info(`Importing data via API at ${config.api.baseUrl}...`);
          
          // Configure axios
          const axiosConfig = {};
          if (config.api.auth) {
            if (config.api.auth.type === 'bearer') {
              axiosConfig.headers = {
                Authorization: `Bearer ${config.api.auth.token}`
              };
            } else if (config.api.auth.type === 'basic') {
              axiosConfig.auth = {
                username: config.api.auth.username,
                password: config.api.auth.password
              };
            }
          }
          
          // Process data items
          const dataToImport = options.index !== undefined ? [data[options.index]] : data;
          let successCount = 0;
          
          for (const item of dataToImport) {
            // Apply overrides if specified
            if (options.overrideCategory) {
              item.CategoryId = options.overrideCategory;
            }
            
            try {
              const response = await axios.post(
                `${config.api.baseUrl}/${options.table}`,
                item,
                axiosConfig
              );
              
              successCount++;
            } catch (err) {
              logger.error(`Error importing item via API: ${err.message}`);
              if (err.response) {
                logger.error(`API responded with status ${err.response.status}: ${JSON.stringify(err.response.data)}`);
              }
            }
          }
          
          logger.success(`Successfully imported ${successCount} of ${dataToImport.length} items via API`);
        } else {
          logger.error('No database or API configuration found. Please check your setup-data.yml file.');
          process.exit(1);
        }
      } catch (error) {
        logger.error(`Import failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Convert command
  program
    .command('convert')
    .description('Convert property names in a JSON file to a different case style')
    .requiredOption('-f, --file <path>', 'Path to the JSON file to convert')
    .requiredOption('-o, --output <path>', 'Path to save the converted JSON file')
    .requiredOption('-c, --case <style>', 'Case style to convert to (pascal, camel, snake, kebab)')
    .action((options) => {
      try {
        logger.info(`Converting ${options.file} to ${options.case}Case...`);
        
        const { transformData } = require('./transformers');
        const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        
        const transformed = transformData(data, { casing: options.case });
        fs.writeFileSync(options.output, JSON.stringify(transformed, null, 2));
        
        logger.success(`Converted data saved to ${options.output}`);
      } catch (error) {
        logger.error(`Conversion failed: ${error.message}`);
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
        logger.info(`Validating data in ${options.file} against schema ${options.schema}...`);
        
        const { validateSchema } = require('./utils/schemaValidator');
        const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        const isValid = await validateSchema(data, options.schema);
        
        if (isValid) {
          logger.success('Validation successful! The data matches the schema.');
        } else {
          logger.error('Validation failed! The data does not match the schema.');
          process.exit(1);
        }
      } catch (error) {
        logger.error(`Validation failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Parse command line arguments
  program.parse(process.argv);

  // Show help if no arguments provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

module.exports = { initCLI };
