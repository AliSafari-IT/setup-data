/**
 * Mock Data Generators
 * 
 * Generates mock data based on schema definitions using Faker.js
 */

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');
const { parseSchema } = require('../utils/schemaParser');

/**
 * Generate mock data based on a schema
 * @param {Object} options Generation options
 * @param {string} options.schemaPath Path to the schema file
 * @param {number} options.count Number of items to generate
 * @param {string} options.tableName Table/entity name
 * @param {number} options.fakerSeed Seed for Faker.js (for reproducible data)
 * @returns {Promise<Array<Object>>} Generated mock data
 */
async function generateMockData({ schemaPath, count = 10, tableName, fakerSeed }) {
  // Set faker seed if provided
  if (fakerSeed !== undefined) {
    faker.seed(fakerSeed);
  }
  
  // Parse the schema
  const schema = await parseSchema(schemaPath, tableName);
  
  // Generate the specified number of mock items
  const mockData = [];
  for (let i = 0; i < count; i++) {
    mockData.push(generateMockItem(schema, i));
  }
  
  return mockData;
}

/**
 * Generate a single mock item based on schema
 * @param {Object} schema Schema definition
 * @param {number} index Current index (useful for generating unique values)
 * @returns {Object} Generated mock item
 */
function generateMockItem(schema, index) {
  const item = {};
  
  for (const [field, definition] of Object.entries(schema.properties)) {
    item[field] = generateFieldValue(field, definition, index);
  }
  
  return item;
}

/**
 * Generate a value for a specific field based on its definition
 * @param {string} fieldName Field name
 * @param {Object} definition Field definition
 * @param {number} index Current index
 * @returns {any} Generated field value
 */
function generateFieldValue(fieldName, definition, index) {
  // Handle specific field name patterns
  const lowerFieldName = fieldName.toLowerCase();
  
  // If the field has a specific faker method defined
  if (definition.faker) {
    return evaluateFakerMethod(definition.faker);
  }
  
  // Handle different data types
  switch (definition.type) {
    case 'string':
      return generateStringValue(fieldName, definition);
    case 'number':
    case 'integer':
      return generateNumberValue(fieldName, definition);
    case 'boolean':
      return faker.datatype.boolean();
    case 'array':
      return generateArrayValue(fieldName, definition, index);
    case 'object':
      return generateObjectValue(definition, index);
    default:
      return null;
  }
}

/**
 * Generate a string value based on field name and definition
 * @param {string} fieldName Field name
 * @param {Object} definition Field definition
 * @returns {string} Generated string value
 */
function generateStringValue(fieldName, definition) {
  const lowerFieldName = fieldName.toLowerCase();
  
  // Check for common field name patterns
  if (lowerFieldName.includes('name')) {
    if (lowerFieldName.includes('first')) {
      return faker.person.firstName();
    } else if (lowerFieldName.includes('last')) {
      return faker.person.lastName();
    } else if (lowerFieldName.includes('full')) {
      return faker.person.fullName();
    } else if (lowerFieldName.includes('product')) {
      return faker.commerce.productName();
    } else if (lowerFieldName.includes('company')) {
      return faker.company.name();
    } else {
      return faker.commerce.productName();
    }
  } else if (lowerFieldName.includes('email')) {
    return faker.internet.email();
  } else if (lowerFieldName.includes('phone')) {
    return faker.phone.number();
  } else if (lowerFieldName.includes('address')) {
    return faker.location.streetAddress();
  } else if (lowerFieldName.includes('city')) {
    return faker.location.city();
  } else if (lowerFieldName.includes('country')) {
    return faker.location.country();
  } else if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
    return faker.location.zipCode();
  } else if (lowerFieldName.includes('description')) {
    return faker.commerce.productDescription();
  } else if (lowerFieldName.includes('image') || lowerFieldName.includes('photo') || lowerFieldName.includes('avatar')) {
    return faker.image.url();
  } else if (lowerFieldName.includes('color')) {
    return faker.color.human();
  } else if (lowerFieldName.includes('date')) {
    return faker.date.past().toISOString();
  } else if (lowerFieldName.includes('uuid')) {
    return faker.string.uuid();
  } else if (lowerFieldName.includes('password')) {
    return faker.internet.password();
  } else if (lowerFieldName.includes('url')) {
    return faker.internet.url();
  } else if (lowerFieldName.includes('sku')) {
    return faker.string.alphanumeric(8).toUpperCase();
  } else if (lowerFieldName.includes('barcode')) {
    return faker.string.numeric(12);
  } else if (lowerFieldName.includes('manufacturer')) {
    return faker.company.name();
  } else if (lowerFieldName.includes('batch')) {
    return `BATCH-${faker.string.alphanumeric(6).toUpperCase()}`;
  } else {
    // Default string generation
    return faker.lorem.word();
  }
}

/**
 * Generate a number value based on field name and definition
 * @param {string} fieldName Field name
 * @param {Object} definition Field definition
 * @returns {number} Generated number value
 */
function generateNumberValue(fieldName, definition) {
  const lowerFieldName = fieldName.toLowerCase();
  
  // Define min and max based on definition or defaults
  const min = definition.minimum !== undefined ? definition.minimum : 0;
  const max = definition.maximum !== undefined ? definition.maximum : 1000;
  
  // Check for common field name patterns
  if (lowerFieldName.includes('price')) {
    return parseFloat(faker.commerce.price({ min, max }));
  } else if (lowerFieldName.includes('quantity') || lowerFieldName.includes('stock')) {
    return faker.number.int({ min, max });
  } else if (lowerFieldName.includes('id')) {
    return faker.number.int({ min: 1, max: 1000 });
  } else if (lowerFieldName.includes('age')) {
    return faker.number.int({ min: 18, max: 90 });
  } else if (lowerFieldName.includes('rating')) {
    return faker.number.float({ min: 0, max: 5, precision: 0.1 });
  } else if (lowerFieldName.includes('percentage')) {
    return faker.number.float({ min: 0, max: 100, precision: 0.01 });
  } else {
    // Default number generation
    return definition.type === 'integer' 
      ? faker.number.int({ min, max }) 
      : faker.number.float({ min, max, precision: 0.01 });
  }
}

/**
 * Generate an array value based on field name and definition
 * @param {string} fieldName Field name
 * @param {Object} definition Field definition
 * @param {number} index Current index
 * @returns {Array<any>} Generated array value
 */
function generateArrayValue(fieldName, definition, index) {
  if (!definition.items) {
    return [];
  }
  
  const minItems = definition.minItems || 0;
  const maxItems = definition.maxItems || 5;
  const count = faker.number.int({ min: minItems, max: maxItems });
  
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(generateFieldValue(`${fieldName}Item`, definition.items, index * 100 + i));
  }
  
  return result;
}

/**
 * Generate an object value based on definition
 * @param {Object} definition Field definition
 * @param {number} index Current index
 * @returns {Object} Generated object value
 */
function generateObjectValue(definition, index) {
  if (!definition.properties) {
    return {};
  }
  
  const result = {};
  for (const [field, fieldDef] of Object.entries(definition.properties)) {
    result[field] = generateFieldValue(field, fieldDef, index);
  }
  
  return result;
}

/**
 * Evaluate a faker method string
 * @param {string} fakerMethod Faker method string (e.g., "commerce.product")
 * @returns {any} Result of the faker method
 */
function evaluateFakerMethod(fakerMethod) {
  try {
    // Split the method path
    const parts = fakerMethod.split('.');
    
    // Start with the faker object
    let current = faker;
    
    // Navigate through the object path
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
      if (!current) {
        throw new Error(`Invalid faker path: ${fakerMethod}`);
      }
    }
    
    // Get the final method
    const method = parts[parts.length - 1];
    if (typeof current[method] !== 'function') {
      throw new Error(`${method} is not a function in faker path: ${fakerMethod}`);
    }
    
    // Call the method
    return current[method]();
  } catch (error) {
    console.error(`Error evaluating faker method ${fakerMethod}: ${error.message}`);
    return faker.lorem.word();
  }
}

module.exports = {
  generateMockData
};
