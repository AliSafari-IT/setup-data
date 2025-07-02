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
    .option('--skip-duplicates', 'Skip duplicate entries instead of failing')
    .option('--update-duplicates', 'Update existing records when duplicates are found')
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
              
              // Add default values for required fields if missing based on entity type
              let defaultValues = {
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
              };
              
              // Add entity-specific default values
              if (options.table.toLowerCase() === 'products') {
                defaultValues = {
                  ...defaultValues,
                  CostPrice: item.Price ? item.Price * 0.6 : 0,
                  StockQuantity: 100,
                  MinStockLevel: 10,
                  MaxStockLevel: 1000,
                  RequiresPrescription: false,
                  Manufacturer: item.Manufacturer || 'Default Manufacturer',
                  BatchNumber: item.BatchNumber || 'DEFAULT-BATCH',
                };
              } else if (options.table.toLowerCase() === 'users') {
                defaultValues = {
                  ...defaultValues,
                  LastLoginAt: new Date(),
                  LicenseNumber: '', // Provide empty string instead of null
                  Phone: '',
                  Department: '',
                  EmployeeId: '',
                  CardId: '',
                  CardExpiryDate: new Date(),
                };
              }
              
              // Merge item with default values for missing fields
              const enrichedItem = { ...defaultValues, ...item };
              
              // Process date fields to ensure proper MySQL format
              for (const [key, value] of Object.entries(enrichedItem)) {
                // Check if the value is a date string (ISO format)
                if (typeof value === 'string' && 
                    (key.includes('Date') || key.includes('At') || key.includes('Time')) && 
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                  try {
                    // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
                    const date = new Date(value);
                    enrichedItem[key] = date.toISOString().slice(0, 19).replace('T', ' ');
                  } catch (e) {
                    logger.warning(`Could not parse date for field ${key}: ${value}`);
                  }
                }
                
                // Convert Role string to enum value for Users table
                if (key === 'Role' && typeof value === 'string' && options.table.toLowerCase() === 'users') {
                  const roleMap = {
                    'admin': 0,
                    'manager': 1,
                    'pharmacist': 2,
                    'technician': 3,
                    'cashier': 4
                  };
                  
                  const roleLower = value.toLowerCase();
                  if (roleMap.hasOwnProperty(roleLower)) {
                    enrichedItem[key] = roleMap[roleLower];
                  } else {
                    logger.warning(`Unknown role: ${value}, defaulting to Pharmacist (2)`);
                    enrichedItem[key] = 2; // Default to Pharmacist
                  }
                }
              }
              
              // Extract fields and values
              const fields = Object.keys(enrichedItem);
              const values = Object.values(enrichedItem);
              const placeholders = fields.map(() => '?').join(', ');
              
              // Determine duplicate handling strategy
              let duplicateStrategy = 'fail'; // Default strategy
              
              // Check command line options first (they override config)
              if (options.skipDuplicates) {
                duplicateStrategy = 'skip';
              } else if (options.updateDuplicates) {
                duplicateStrategy = 'update';
              } 
              // Then check config if no command line options
              else if (config.database?.duplicates?.strategy) {
                duplicateStrategy = config.database.duplicates.strategy;
              }
              
              // Get unique keys for this table if defined in config
              const uniqueKeys = config.database?.duplicates?.keys?.[options.table] || [];
              
              let query;
              if (duplicateStrategy === 'update' && uniqueKeys.length > 0) {
                // Build ON DUPLICATE KEY UPDATE clause
                const updateClause = fields
                  .filter(field => !uniqueKeys.includes(field)) // Don't update the key fields
                  .map(field => `${field} = VALUES(${field})`)
                  .join(', ');
                
                query = `INSERT INTO ${options.table} (${fields.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;
                logger.info(`Using update strategy for duplicates with keys: ${uniqueKeys.join(', ')}`);
              } else {
                // Standard insert
                query = `INSERT INTO ${options.table} (${fields.join(', ')}) VALUES (${placeholders})`;
              }
              
              try {
                const [result] = await connection.query(query, values);
                successCount++;
              } catch (err) {
                // Check if it's a duplicate entry error
                if (err.message.includes('Duplicate entry') && duplicateStrategy === 'skip') {
                  logger.warning(`Skipping duplicate item: ${err.message}`);
                } else {
                  logger.error(`Error inserting item: ${err.message}`);
                  if (config.database.transactional !== false) {
                    await connection.query('ROLLBACK');
                    logger.info('Transaction rolled back due to error');
                    process.exit(1);
                  }
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

  // Generate from C# command
  program
    .command('generate-from-csharp')
    .description('Generate mock data for all entities in a directory of C# classes')
    .requiredOption('-d, --directory <path>', 'Directory containing C# entity classes')
    .option('-o, --output <path>', 'Output directory for generated JSON files', './generated-data')
    .option('-c, --config <path>', 'Path to the configuration file (default: ./setup-data.yml)')
    .option('-n, --count <number>', 'Number of entities to generate for each schema', '20')
    .option('-s, --seed <number>', 'Seed for the random data generator')
    .option('-i, --import', 'Automatically import generated data to database', false)
    .action(async (options) => {
      try {
        logger.info(`Generating mock data for all entities in ${options.directory}...`);
        
        const yaml = require('js-yaml');
        const configPath = options.config || './setup-data.yml';
        let config = {};
        
        try {
          config = yaml.load(fs.readFileSync(configPath, 'utf8'));
          logger.info(`Loaded configuration from ${configPath}`);
        } catch (err) {
          logger.warning(`Could not load config file: ${err.message}. Using default settings.`);
        }
        
        // Import the generateAllEntities function
        const { generateAllEntities } = require('./csharp-generator');
        
        // Generate mock data for all entities
        const generatedEntities = await generateAllEntities({
          directory: options.directory,
          output: options.output,
          count: parseInt(options.count),
          seed: options.seed || config.mock?.seed || 123
        });
        
        if (options.import) {
          logger.info('Auto-import feature will be available in the next version.');
          logger.info(`You can run 'node ${options.output}/import-all.js' to import all entities in the correct order.`);
        } else {
          logger.info(`Generated data saved to ${options.output} directory.`);
          logger.info(`Run 'node ${options.output}/import-all.js' to import all entities in the correct order.`);
        }
        
      } catch (error) {
        logger.error(`Failed to generate data: ${error.message}`);
        process.exit(1);
      }
    });

  // Generate command
  program
    .command('generate')
    .description('Generate mock data based on a schema')
    .requiredOption('-t, --table <name>', 'Name of the table or entity to generate data for')
    .requiredOption('-s, --schema <path>', 'Path to the schema file (C#, TypeScript, or JSON)')
    .option('-c, --config <path>', 'Path to the configuration file (default: ./setup-data.yml)')
    .option('-n, --count <number>', 'Number of items to generate', parseInt, 10)
    .option('-o, --output <path>', 'Path to save the generated data as JSON')
    .option('--seed <number>', 'Seed for the random data generator', parseInt)
    .action(async (options) => {
      try {
        logger.info(`Generating ${options.count} mock ${options.table} items based on schema ${options.schema}...`);
        
        const yaml = require('js-yaml');
        const configPath = options.config || './setup-data.yml';
        let config = {};
        
        try {
          config = yaml.load(fs.readFileSync(configPath, 'utf8'));
          logger.info(`Loaded configuration from ${configPath}`);
        } catch (err) {
          logger.warning(`Could not load config file: ${err.message}. Using default settings.`);
        }
        
        // Import the generateMockData function
        const { generateMockData } = require('./generators');
        
        // Generate mock data
        const mockData = await generateMockData({
          schemaPath: options.schema,
          count: options.count,
          tableName: options.table,
          fakerSeed: options.seed || config.mock?.seed || 123,
          generators: config.mock?.generators || {}
        });
        
        // Save to file if output path is provided
        if (options.output) {
          fs.writeFileSync(options.output, JSON.stringify(mockData, null, 2));
          logger.success(`Generated data saved to ${options.output}`);
        }
        
        // Import to database if configured
        if (!options.output && config.database && config.database.useDirectConnection) {
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
            
            let successCount = 0;
            
            for (const item of mockData) {
              // Extract fields and values
              const fields = Object.keys(item);
              const values = Object.values(item);
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
            
            logger.success(`Successfully imported ${successCount} of ${mockData.length} generated items to ${options.table}`);
          } finally {
            await connection.end();
          }
        } else if (!options.output && config.api) {
          // Import via API if configured
          const axios = require('axios');
          logger.info(`Importing generated data via API at ${config.api.baseUrl}...`);
          
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
          
          let successCount = 0;
          
          for (const item of mockData) {
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
          
          logger.success(`Successfully imported ${successCount} of ${mockData.length} generated items via API`);
        } else if (!options.output) {
          // Just display the generated data if no output or import is configured
          console.log(JSON.stringify(mockData, null, 2));
          logger.success(`Generated ${mockData.length} items. Data displayed above.`);
        }
      } catch (error) {
        logger.error(`Generation failed: ${error.message}`);
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
