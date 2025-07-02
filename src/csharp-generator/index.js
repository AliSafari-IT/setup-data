/**
 * C# Entity Mock Data Generator
 * Generates mock data based on parsed C# entity classes
 */

const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { parseEntityDirectory, buildDependencyGraph, topologicalSort } = require('../csharp-parser');

/**
 * Generate mock data for a specific entity based on its schema
 * @param {Object} entityInfo - Entity information from parser
 * @param {number} count - Number of entities to generate
 * @param {Object} dependencies - Already generated entities for dependencies
 * @returns {Array} Generated entities
 */
function generateMockData(entityInfo, count, dependencies = {}) {
  const entities = [];
  
  for (let i = 0; i < count; i++) {
    const entity = {};
    
    // Generate data for each property
    entityInfo.properties.forEach(prop => {
      // Skip navigation properties as they're handled separately
      if (prop.isNavigation) return;
      
      // Handle foreign keys
      if (prop.name.endsWith('Id') && dependencies[prop.name.slice(0, -2)]) {
        const dependencyEntities = dependencies[prop.name.slice(0, -2)];
        if (dependencyEntities && dependencyEntities.length > 0) {
          entity[prop.name] = faker.helpers.arrayElement(dependencyEntities).Id;
        } else {
          entity[prop.name] = null;
        }
        return;
      }
      
      // Generate based on property type and name
      entity[prop.name] = generateValueForProperty(prop, entityInfo);
    });
    
    entities.push(entity);
  }
  
  return entities;
}

/**
 * Generate appropriate value for a property based on its type and name
 * @param {Object} prop - Property information
 * @param {Object} entityInfo - Parent entity information
 * @returns {*} Generated value
 */
function generateValueForProperty(prop, entityInfo) {
  const { name, type, attributes, isRequired, maxLength, defaultValue } = prop;
  
  // Handle nullable types
  const isNullable = type.endsWith('?');
  const baseType = isNullable ? type.slice(0, -1) : type;
  
  // Check if should be null
  if (isNullable && !isRequired && Math.random() > 0.8) {
    return null;
  }
  
  // Handle enums
  if (entityInfo.enums[baseType]) {
    const enumValues = entityInfo.enums[baseType];
    return faker.helpers.arrayElement(enumValues).value;
  }
  
  // Generate based on common property name patterns
  if (name === 'Id') return null; // Will be auto-assigned by DB
  
  // Names
  if (name === 'FirstName') return faker.person.firstName();
  if (name === 'LastName') return faker.person.lastName();
  if (name === 'FullName') return `${faker.person.firstName()} ${faker.person.lastName()}`;
  if (name.includes('Name') && !name.includes('First') && !name.includes('Last')) {
    if (entityInfo.entityName === 'Product') return faker.commerce.productName();
    if (entityInfo.entityName === 'Company' || entityInfo.entityName === 'Supplier') return faker.company.name();
    return faker.lorem.word();
  }
  
  // Contact info
  if (name.includes('Email')) return faker.internet.email().toLowerCase();
  if (name.includes('Phone')) return faker.phone.number();
  if (name.includes('Address') && !name.includes('Email')) return faker.location.streetAddress();
  if (name === 'City') return faker.location.city();
  if (name === 'Country') return faker.location.country();
  if (name === 'PostalCode' || name === 'ZipCode') return faker.location.zipCode();
  
  // Descriptions
  if (name.includes('Description')) return faker.lorem.paragraph();
  if (name === 'Notes' || name === 'Comments') return faker.lorem.sentences();
  
  // Financial
  if (name.includes('Price')) return parseFloat(faker.commerce.price());
  if (name.includes('Cost')) return parseFloat(faker.commerce.price());
  if (name.includes('Amount')) return parseFloat(faker.finance.amount());
  if (name.includes('Discount')) return parseFloat(faker.finance.amount(0, 20, 2));
  if (name.includes('Tax')) return parseFloat(faker.finance.amount(0, 10, 2));
  
  // Quantities
  if (name.includes('Quantity') || name.includes('Stock')) return faker.number.int({ min: 1, max: 100 });
  if (name.includes('Min')) return faker.number.int({ min: 1, max: 10 });
  if (name.includes('Max')) return faker.number.int({ min: 50, max: 200 });
  
  // Booleans
  if (name.startsWith('Is') || name.startsWith('Has') || name.startsWith('Requires')) return faker.datatype.boolean();
  
  // Handle specific types
  switch (baseType) {
    case 'string':
      return generateString(maxLength);
    case 'int':
    case 'Int32':
      return faker.number.int({ min: 1, max: 1000 });
    case 'long':
    case 'Int64':
      return faker.number.int({ min: 1, max: 1000000 });
    case 'decimal':
    case 'double':
    case 'float':
      return parseFloat(faker.finance.amount(0, 1000, 2));
    case 'bool':
    case 'Boolean':
      return faker.datatype.boolean();
    case 'DateTime':
      if (name === 'CreatedAt' || name.includes('Create')) {
        return formatDate(faker.date.past());
      } 
      if (name === 'UpdatedAt' || name.includes('Update')) {
        return formatDate(faker.date.recent());
      }
      if (name.includes('Birth')) {
        return formatDate(faker.date.birthdate());
      }
      if (name.includes('Expiry')) {
        return formatDate(faker.date.future());
      }
      return formatDate(faker.date.recent());
    case 'Guid':
      return faker.string.uuid();
    default:
      return generateString(10);
  }
}

/**
 * Generate an appropriate string value
 * @param {number} maxLength - Maximum length constraint if any
 * @returns {string} Generated string
 */
function generateString(maxLength) {
  let length = maxLength ? Math.min(maxLength, 20) : 10;
  return faker.lorem.words(Math.max(1, Math.floor(length / 5))).substring(0, length);
}

/**
 * Format date to MySQL format (YYYY-MM-DD HH:MM:SS)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Generate mock data for all entities in a directory
 * @param {Object} options - Options for generation
 * @returns {Object} Map of entity names to generated entities
 */
async function generateAllEntities(options) {
  const { directory, output, count = 10, seed = 123 } = options;
  
  // Set seed for reproducible results
  faker.seed(parseInt(seed));
  
  // Parse all entities
  console.log(chalk.blue(`ℹ Parsing C# entity classes from ${directory}...`));
  const entities = parseEntityDirectory(directory);
  
  // Build dependency graph and sort entities
  console.log(chalk.blue(`ℹ Building entity dependency graph...`));
  const graph = buildDependencyGraph(entities);
  const sortedEntities = topologicalSort(graph);
  
  console.log(chalk.blue(`ℹ Generating mock data in dependency order: ${sortedEntities.join(', ')}`));
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }
  
  // Generate data in order of dependencies
  const generatedEntities = {};
  
  for (const entityName of sortedEntities) {
    console.log(chalk.blue(`ℹ Generating data for ${entityName}...`));
    const entityInfo = entities[entityName];
    const mockData = generateMockData(entityInfo, count, generatedEntities);
    generatedEntities[entityName] = mockData;
    
    // Write to file
    const outputPath = path.join(output, `${entityName.toLowerCase()}-generated.json`);
    fs.writeFileSync(outputPath, JSON.stringify(mockData, null, 2));
    console.log(chalk.green(`✓ Generated ${mockData.length} ${entityName} entities and saved to ${outputPath}`));
  }
  
  // Create import script
  generateImportScript(sortedEntities, output);
  
  return generatedEntities;
}

/**
 * Generate a script to import all entities in the correct order
 * @param {Array} sortedEntities - Entities in dependency order
 * @param {string} outputDir - Output directory
 */
function generateImportScript(sortedEntities, outputDir) {
  const scriptPath = path.join(outputDir, 'import-all.js');
  const scriptContent = `/**
 * Auto-generated script to import all entities in the correct order
 * Run with: node import-all.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Import entities in dependency order
const entitiesToImport = [
${sortedEntities.map(e => `  { name: '${e}', file: './${e.toLowerCase()}-generated.json' }`).join(',\n')}
];

async function importAll() {
  for (const entity of entitiesToImport) {
    console.log(\`Importing \${entity.name}...\`);
    try {
      const { stdout } = await execPromise(\`pnpm setup-data import -f \${entity.file} -t \${entity.name}\`);
      console.log(stdout);
    } catch (error) {
      console.error(\`Error importing \${entity.name}: \${error.message}\`);
      process.exit(1);
    }
  }
  console.log('All entities imported successfully!');
}

importAll();
`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(chalk.green(`✓ Generated import script at ${scriptPath}`));
}

module.exports = {
  generateMockData,
  generateAllEntities
};
