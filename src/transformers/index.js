/**
 * Data Transformers
 * 
 * Handles transforming data between different formats and case styles
 */

/**
 * Transform data according to provided options
 * @param {Array<Object>|Object} data Data to transform
 * @param {Object} options Transformation options
 * @returns {Array<Object>|Object} Transformed data
 */
function transformData(data, options = {}) {
  const isArray = Array.isArray(data);
  const dataArray = isArray ? data : [data];
  
  const transformedData = dataArray.map(item => {
    let transformed = { ...item };
    
    // Apply case transformation if specified
    if (options.casing) {
      transformed = transformCase(transformed, options.casing);
    }
    
    // Apply any additional transformations here
    
    return transformed;
  });
  
  return isArray ? transformedData : transformedData[0];
}

/**
 * Transform object keys to the specified case style
 * @param {Object} obj Object to transform
 * @param {string} caseStyle Case style to transform to ('camel', 'pascal', 'snake', 'kebab')
 * @returns {Object} Transformed object
 */
function transformCase(obj, caseStyle) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    let transformedKey;
    
    switch (caseStyle.toLowerCase()) {
      case 'pascal':
        transformedKey = toPascalCase(key);
        break;
      case 'camel':
        transformedKey = toCamelCase(key);
        break;
      case 'snake':
        transformedKey = toSnakeCase(key);
        break;
      case 'kebab':
        transformedKey = toKebabCase(key);
        break;
      default:
        transformedKey = key;
    }
    
    // Recursively transform nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[transformedKey] = transformCase(value, caseStyle);
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      // Transform objects in arrays
      result[transformedKey] = value.map(item => 
        typeof item === 'object' ? transformCase(item, caseStyle) : item
      );
    } else {
      result[transformedKey] = value;
    }
  }
  
  return result;
}

/**
 * Convert a string to PascalCase
 * @param {string} str String to convert
 * @returns {string} PascalCase string
 */
function toPascalCase(str) {
  // Handle special case for ID at the end of the string
  if (str.toLowerCase().endsWith('id')) {
    const base = str.slice(0, -2);
    return toPascalCase(base) + 'Id';
  }
  
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Convert a string to camelCase
 * @param {string} str String to convert
 * @returns {string} camelCase string
 */
function toCamelCase(str) {
  // Handle special case for ID at the end of the string
  if (str.toLowerCase().endsWith('id')) {
    const base = str.slice(0, -2);
    return toCamelCase(base) + 'Id';
  }
  
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert a string to snake_case
 * @param {string} str String to convert
 * @returns {string} snake_case string
 */
function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[-\s]/g, '_');
}

/**
 * Convert a string to kebab-case
 * @param {string} str String to convert
 * @returns {string} kebab-case string
 */
function toKebabCase(str) {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/[_\s]/g, '-');
}

module.exports = {
  transformData,
  transformCase,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase
};
