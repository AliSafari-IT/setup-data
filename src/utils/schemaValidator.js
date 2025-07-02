/**
 * Schema Validator
 * 
 * Validates data against schema definitions
 */

const { parseSchema } = require('./schemaParser');

/**
 * Validate data against a schema
 * @param {Array<Object>|Object} data Data to validate
 * @param {string} schemaPath Path to the schema file
 * @returns {Promise<boolean>} Validation result
 */
async function validateSchema(data, schemaPath) {
  try {
    const schema = await parseSchema(schemaPath);
    const isArray = Array.isArray(data);
    const dataArray = isArray ? data : [data];
    
    let isValid = true;
    const errors = [];
    
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const itemErrors = validateObject(item, schema);
      
      if (itemErrors.length > 0) {
        isValid = false;
        errors.push({
          index: i,
          errors: itemErrors
        });
      }
    }
    
    if (!isValid) {
      console.error('Schema validation failed:');
      console.error(JSON.stringify(errors, null, 2));
    }
    
    return isValid;
  } catch (error) {
    console.error(`Schema validation error: ${error.message}`);
    return false;
  }
}

/**
 * Validate an object against a schema
 * @param {Object} obj Object to validate
 * @param {Object} schema Schema to validate against
 * @returns {Array<string>} Validation errors
 */
function validateObject(obj, schema) {
  const errors = [];
  
  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredField of schema.required) {
      if (obj[requiredField] === undefined) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (obj[propName] !== undefined) {
        const propErrors = validateProperty(obj[propName], propSchema, propName);
        errors.push(...propErrors);
      }
    }
  }
  
  return errors;
}

/**
 * Validate a property value against its schema
 * @param {any} value Property value
 * @param {Object} schema Property schema
 * @param {string} propName Property name
 * @returns {Array<string>} Validation errors
 */
function validateProperty(value, schema, propName) {
  const errors = [];
  
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${propName} should be a string, got ${typeof value}`);
      } else {
        // Check string format if specified
        if (schema.format === 'date-time') {
          if (isNaN(Date.parse(value))) {
            errors.push(`${propName} should be a valid date-time string`);
          }
        }
        
        // Check min/max length
        if (schema.minLength !== undefined && value.length < schema.minLength) {
          errors.push(`${propName} should be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
          errors.push(`${propName} should be at most ${schema.maxLength} characters`);
        }
        
        // Check pattern
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push(`${propName} does not match required pattern: ${schema.pattern}`);
        }
        
        // Check enum
        if (schema.enum && !schema.enum.includes(value)) {
          errors.push(`${propName} should be one of: ${schema.enum.join(', ')}`);
        }
      }
      break;
    
    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        errors.push(`${propName} should be a number, got ${typeof value}`);
      } else {
        if (schema.type === 'integer' && !Number.isInteger(value)) {
          errors.push(`${propName} should be an integer`);
        }
        
        // Check min/max
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push(`${propName} should be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push(`${propName} should be at most ${schema.maximum}`);
        }
      }
      break;
    
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${propName} should be a boolean, got ${typeof value}`);
      }
      break;
    
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${propName} should be an array, got ${typeof value}`);
      } else {
        // Check min/max items
        if (schema.minItems !== undefined && value.length < schema.minItems) {
          errors.push(`${propName} should have at least ${schema.minItems} items`);
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
          errors.push(`${propName} should have at most ${schema.maxItems} items`);
        }
        
        // Validate array items
        if (schema.items) {
          for (let i = 0; i < value.length; i++) {
            const itemErrors = validateProperty(
              value[i], 
              schema.items, 
              `${propName}[${i}]`
            );
            errors.push(...itemErrors);
          }
        }
      }
      break;
    
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${propName} should be an object, got ${typeof value}`);
      } else if (schema.properties) {
        // Validate nested object
        const nestedErrors = validateObject(value, schema);
        errors.push(...nestedErrors.map(err => `${propName}.${err}`));
      }
      break;
  }
  
  return errors;
}

module.exports = {
  validateSchema
};
