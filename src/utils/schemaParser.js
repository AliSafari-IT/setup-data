/**
 * Schema Parser
 * 
 * Parses schema definitions from various formats including C# classes
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a schema from a file
 * @param {string} schemaPath Path to the schema file
 * @param {string} tableName Table/entity name (optional)
 * @returns {Promise<Object>} Parsed schema
 */
async function parseSchema(schemaPath, tableName) {
  if (!schemaPath) {
    throw new Error('Schema path is required');
  }
  
  const extension = path.extname(schemaPath).toLowerCase();
  
  switch (extension) {
    case '.json':
      return parseJsonSchema(schemaPath, tableName);
    case '.cs':
      return parseCSharpSchema(schemaPath);
    case '.ts':
    case '.tsx':
      return parseTypeScriptSchema(schemaPath);
    default:
      throw new Error(`Unsupported schema file type: ${extension}`);
  }
}

/**
 * Parse a JSON schema file
 * @param {string} schemaPath Path to the JSON schema file
 * @param {string} tableName Table/entity name (optional)
 * @returns {Promise<Object>} Parsed schema
 */
function parseJsonSchema(schemaPath, tableName) {
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    // If tableName is provided and the schema has definitions/components,
    // try to find the specific schema for the table
    if (tableName) {
      if (schema.definitions && schema.definitions[tableName]) {
        return schema.definitions[tableName];
      } else if (schema.components && schema.components.schemas && schema.components.schemas[tableName]) {
        return schema.components.schemas[tableName];
      }
    }
    
    return schema;
  } catch (error) {
    throw new Error(`Failed to parse JSON schema: ${error.message}`);
  }
}

/**
 * Parse a C# class file to extract schema
 * @param {string} schemaPath Path to the C# class file
 * @returns {Promise<Object>} Parsed schema
 */
function parseCSharpSchema(schemaPath) {
  try {
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    // Extract class name
    const classNameMatch = content.match(/class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : 'Unknown';
    
    // Initialize schema
    const schema = {
      type: 'object',
      title: className,
      properties: {}
    };
    
    // Regular expression to match C# properties
    // This handles various property types including:
    // - public string Name { get; set; }
    // - [Required] public int Id { get; set; }
    // - [Column("user_id")] public int UserId { get; set; }
    // - public List<OrderItem> Items { get; set; }
    const propertyRegex = /\[?.*?\]?\s*public\s+(?:virtual\s+)?(\w+(?:<\w+>)?(?:\[\])?)\s+(\w+)\s*(?:{\s*get;\s*(?:private\s+)?set;\s*}|;)/g;
    
    let match;
    while ((match = propertyRegex.exec(content)) !== null) {
      const type = match[1];
      const name = match[2];
      
      // Convert C# type to JSON schema type
      schema.properties[name] = mapCSharpTypeToJsonSchema(type, name);
      
      // Check for required attribute
      const requiredMatch = content.match(new RegExp(`\\[Required\\][^\\n]*?${name}\\s*{`));
      if (requiredMatch) {
        if (!schema.required) {
          schema.required = [];
        }
        schema.required.push(name);
      }
    }
    
    return schema;
  } catch (error) {
    throw new Error(`Failed to parse C# schema: ${error.message}`);
  }
}

/**
 * Parse a TypeScript interface/class file to extract schema
 * @param {string} schemaPath Path to the TypeScript file
 * @returns {Promise<Object>} Parsed schema
 */
function parseTypeScriptSchema(schemaPath) {
  try {
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    // Extract interface/class name
    const nameMatch = content.match(/(?:interface|class)\s+(\w+)/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';
    
    // Initialize schema
    const schema = {
      type: 'object',
      title: name,
      properties: {}
    };
    
    // Regular expression to match TypeScript properties
    // This handles various property types including:
    // - name: string;
    // - id?: number;
    // - items: Array<Item>;
    // - status: 'active' | 'inactive';
    const propertyRegex = /(readonly\s+)?(\w+)(\?)?:\s*([^;]+);/g;
    
    let match;
    while ((match = propertyRegex.exec(content)) !== null) {
      const name = match[2];
      const optional = match[3] === '?';
      const type = match[4].trim();
      
      // Convert TypeScript type to JSON schema type
      schema.properties[name] = mapTypeScriptTypeToJsonSchema(type, name);
      
      // Add to required array if not optional
      if (!optional) {
        if (!schema.required) {
          schema.required = [];
        }
        schema.required.push(name);
      }
    }
    
    return schema;
  } catch (error) {
    throw new Error(`Failed to parse TypeScript schema: ${error.message}`);
  }
}

/**
 * Map C# type to JSON schema type
 * @param {string} csharpType C# type
 * @param {string} fieldName Field name (for heuristics)
 * @returns {Object} JSON schema type definition
 */
function mapCSharpTypeToJsonSchema(csharpType, fieldName) {
  const lowerType = csharpType.toLowerCase();
  
  // Handle nullable types
  const isNullable = lowerType.includes('?');
  const baseType = isNullable ? lowerType.replace('?', '') : lowerType;
  
  // Handle arrays
  if (lowerType.includes('list<') || lowerType.includes('ienumerable<') || lowerType.includes('icollection<') || lowerType.endsWith('[]')) {
    let itemType;
    if (lowerType.endsWith('[]')) {
      itemType = lowerType.substring(0, lowerType.length - 2);
    } else {
      const match = lowerType.match(/<([^>]+)>/);
      itemType = match ? match[1] : 'object';
    }
    
    return {
      type: 'array',
      items: mapCSharpTypeToJsonSchema(itemType, `${fieldName}Item`)
    };
  }
  
  // Map basic types
  switch (baseType) {
    case 'string':
    case 'char':
    case 'guid':
      return { type: 'string' };
    
    case 'int':
    case 'int32':
    case 'long':
    case 'int64':
    case 'short':
    case 'byte':
      return { type: 'integer' };
    
    case 'decimal':
    case 'double':
    case 'float':
      return { type: 'number' };
    
    case 'bool':
    case 'boolean':
      return { type: 'boolean' };
    
    case 'datetime':
    case 'datetimeoffset':
    case 'timespan':
      return { 
        type: 'string',
        format: 'date-time'
      };
    
    case 'date':
      return { 
        type: 'string',
        format: 'date'
      };
    
    default:
      // For complex types, create a generic object schema
      return { type: 'object' };
  }
}

/**
 * Map TypeScript type to JSON schema type
 * @param {string} tsType TypeScript type
 * @param {string} fieldName Field name (for heuristics)
 * @returns {Object} JSON schema type definition
 */
function mapTypeScriptTypeToJsonSchema(tsType, fieldName) {
  const lowerType = tsType.toLowerCase();
  
  // Handle arrays
  if (lowerType.startsWith('array<') || lowerType.endsWith('[]')) {
    let itemType;
    if (lowerType.endsWith('[]')) {
      itemType = lowerType.substring(0, lowerType.length - 2);
    } else {
      const match = lowerType.match(/<([^>]+)>/);
      itemType = match ? match[1] : 'any';
    }
    
    return {
      type: 'array',
      items: mapTypeScriptTypeToJsonSchema(itemType, `${fieldName}Item`)
    };
  }
  
  // Handle union types
  if (lowerType.includes('|')) {
    const types = lowerType.split('|').map(t => t.trim());
    
    // Check if all types are string literals
    const allStringLiterals = types.every(t => t.startsWith("'") && t.endsWith("'"));
    
    if (allStringLiterals) {
      return {
        type: 'string',
        enum: types.map(t => t.substring(1, t.length - 1))
      };
    }
    
    // Otherwise, use the first non-null type
    const nonNullType = types.find(t => t !== 'null' && t !== 'undefined');
    if (nonNullType) {
      return mapTypeScriptTypeToJsonSchema(nonNullType, fieldName);
    }
    
    return { type: 'string' };
  }
  
  // Map basic types
  switch (lowerType) {
    case 'string':
      return { type: 'string' };
    
    case 'number':
    case 'bigint':
      return { type: 'number' };
    
    case 'boolean':
      return { type: 'boolean' };
    
    case 'date':
      return { 
        type: 'string',
        format: 'date-time'
      };
    
    case 'any':
    case 'unknown':
    default:
      // For complex or unknown types, create a generic object schema
      return { type: 'object' };
  }
}

module.exports = {
  parseSchema
};
