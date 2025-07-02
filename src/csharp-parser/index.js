/**
 * C# Entity Class Parser
 * Parses C# entity classes to extract properties, types, and relationships
 * for generating mock data
 */

const fs = require('fs');
const path = require('path');

// Regular expressions for parsing C# classes
const CLASS_REGEX = /public\s+class\s+(\w+)/;
const PROPERTY_REGEX = /public\s+([\w<>?]+)\s+(\w+)\s*{\s*get;\s*set;\s*}(\s*=\s*([^;]+))?/g;
const ATTRIBUTE_REGEX = /\[\s*(\w+)(?:\(([^)]*)\))?\s*\]/g;
const ENUM_REGEX = /public\s+enum\s+(\w+)\s*{([^}]*)}/g;

/**
 * Parse a C# file to extract entity information
 * @param {string} filePath - Path to the C# file
 * @returns {Object} Entity information including name, properties, and relationships
 */
function parseEntityFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.cs');
    
    // Extract class name
    const classMatch = content.match(CLASS_REGEX);
    if (!classMatch) {
      throw new Error(`Could not find class definition in ${fileName}`);
    }
    
    const className = classMatch[1];
    
    // Extract properties
    const properties = [];
    let propertyMatch;
    let currentAttributes = [];
    
    // First collect all attributes
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line contains an attribute
      if (line.startsWith('[')) {
        const attrMatch = [...line.matchAll(ATTRIBUTE_REGEX)];
        if (attrMatch.length > 0) {
          attrMatch.forEach(match => {
            currentAttributes.push({
              name: match[1],
              parameters: match[2] ? match[2].split(',').map(p => p.trim()) : []
            });
          });
        }
      } 
      // If it's a property definition, associate collected attributes
      else if (line.includes('get;') && line.includes('set;')) {
        const propMatch = [...line.matchAll(PROPERTY_REGEX)];
        if (propMatch.length > 0) {
          propMatch.forEach(match => {
            const propType = match[1];
            const propName = match[2];
            const defaultValue = match[4] || null;
            
            properties.push({
              name: propName,
              type: propType,
              attributes: [...currentAttributes],
              defaultValue: defaultValue,
              isRequired: currentAttributes.some(attr => attr.name === 'Required'),
              maxLength: extractMaxLength(currentAttributes),
              isNavigation: isNavigationProperty(propType, content)
            });
            
            // Reset attributes for next property
            currentAttributes = [];
          });
        }
      } 
      // If line doesn't have property or attribute, clear collected attributes
      else if (!line.startsWith('//') && !line.startsWith('/*') && line !== '') {
        currentAttributes = [];
      }
    }
    
    // Extract enums
    const enums = {};
    let enumMatch;
    while ((enumMatch = ENUM_REGEX.exec(content)) !== null) {
      const enumName = enumMatch[1];
      const enumValues = enumMatch[2]
        .split(',')
        .map(v => v.trim())
        .filter(v => v !== '')
        .map((v, i) => {
          const parts = v.split('=');
          return {
            name: parts[0].trim(),
            value: parts.length > 1 ? parseInt(parts[1].trim()) : i
          };
        });
      
      enums[enumName] = enumValues;
    }
    
    // Extract relationships
    const relationships = extractRelationships(properties, content);
    
    return {
      entityName: className,
      properties: properties,
      relationships: relationships,
      enums: enums
    };
  } catch (error) {
    console.error(`Error parsing file ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * Extract MaxLength value from attributes
 * @param {Array} attributes - List of attributes
 * @returns {number|null} MaxLength value or null
 */
function extractMaxLength(attributes) {
  const maxLengthAttr = attributes.find(attr => attr.name === 'MaxLength');
  if (maxLengthAttr && maxLengthAttr.parameters.length > 0) {
    return parseInt(maxLengthAttr.parameters[0]);
  }
  return null;
}

/**
 * Check if a property is a navigation property
 * @param {string} propType - Property type
 * @param {string} content - Full class content
 * @returns {boolean} Is navigation property
 */
function isNavigationProperty(propType, content) {
  // Navigation properties are usually other entity types or collections of entities
  return propType.includes('ICollection<') || 
         propType.includes('List<') || 
         propType.includes('HashSet<') ||
         (!propType.startsWith('string') && 
          !propType.startsWith('int') && 
          !propType.startsWith('decimal') && 
          !propType.startsWith('double') && 
          !propType.startsWith('float') && 
          !propType.startsWith('bool') && 
          !propType.startsWith('DateTime') && 
          !propType.startsWith('Guid') &&
          !propType.includes('?') &&
          content.includes(`public class ${propType}`));
}

/**
 * Extract relationships between entities
 * @param {Array} properties - List of properties
 * @param {string} content - Full class content
 * @returns {Array} Relationships
 */
function extractRelationships(properties, content) {
  const relationships = [];
  
  properties.forEach(prop => {
    if (prop.isNavigation) {
      let relationType = 'oneToOne';
      let targetEntity = prop.type;
      
      if (prop.type.includes('ICollection<') || 
          prop.type.includes('List<') || 
          prop.type.includes('HashSet<')) {
        relationType = 'oneToMany';
        targetEntity = prop.type.match(/<([^>]+)>/)[1];
      }
      
      relationships.push({
        propertyName: prop.name,
        targetEntity: targetEntity,
        type: relationType
      });
    } else if (prop.name.endsWith('Id') && prop.type === 'int') {
      // Foreign key property (e.g., UserId)
      const targetEntity = prop.name.slice(0, -2);
      relationships.push({
        propertyName: prop.name,
        targetEntity: targetEntity,
        type: 'manyToOne'
      });
    }
  });
  
  return relationships;
}

/**
 * Parse a directory of C# entity files
 * @param {string} dirPath - Directory path
 * @returns {Object} Map of entity names to entity info
 */
function parseEntityDirectory(dirPath) {
  const entities = {};
  
  const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.cs'));
  
  files.forEach(file => {
    try {
      const filePath = path.join(dirPath, file);
      const entityInfo = parseEntityFile(filePath);
      entities[entityInfo.entityName] = entityInfo;
    } catch (error) {
      console.warn(`Skipping file ${file}: ${error.message}`);
    }
  });
  
  return entities;
}

/**
 * Build a dependency graph for entities
 * @param {Object} entities - Map of entity names to entity info
 * @returns {Object} Dependency graph
 */
function buildDependencyGraph(entities) {
  const graph = {};
  
  Object.keys(entities).forEach(entityName => {
    graph[entityName] = {
      entity: entities[entityName],
      dependencies: entities[entityName].relationships
        .filter(rel => rel.type === 'manyToOne')
        .map(rel => rel.targetEntity)
    };
  });
  
  return graph;
}

/**
 * Sort entities by dependency (topological sort)
 * @param {Object} graph - Dependency graph
 * @returns {Array} Sorted entity names
 */
function topologicalSort(graph) {
  const visited = {};
  const temp = {};
  const result = [];
  const cycles = new Set();
  
  function visit(node, path = []) {
    // Already completely processed this node
    if (visited[node]) return;
    
    // Detect cycle
    if (temp[node]) {
      console.warn(`Cyclic dependency detected involving ${node}`);
      // Find the cycle
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart).concat(node);
        console.warn(`Cycle: ${cycle.join(' -> ')}`);
        cycles.add(node);
      }
      return;
    }
    
    // Mark as temporarily visited
    temp[node] = true;
    path.push(node);
    
    // Visit dependencies
    if (graph[node] && graph[node].dependencies) {
      graph[node].dependencies.forEach(dep => {
        if (graph[dep] && !cycles.has(dep)) {
          visit(dep, [...path]);
        }
      });
    }
    
    // Mark as completely visited
    temp[node] = false;
    visited[node] = true;
    result.push(node);
  }
  
  // First pass to identify cycles
  Object.keys(graph).forEach(node => {
    if (!visited[node]) {
      visit(node);
    }
  });
  
  // Reset for second pass
  Object.keys(visited).forEach(key => { visited[key] = false; });
  const result2 = [];
  
  // Second pass to ensure all nodes get included
  Object.keys(graph).forEach(node => {
    if (!visited[node]) {
      // Simplified visit function that doesn't recurse into known cycle nodes
      const simpleVisit = (n) => {
        if (visited[n]) return;
        visited[n] = true;
        
        if (graph[n] && graph[n].dependencies) {
          graph[n].dependencies.forEach(dep => {
            if (graph[dep] && !cycles.has(dep)) {
              simpleVisit(dep);
            }
          });
        }
        
        result2.push(n);
      };
      
      simpleVisit(node);
    }
  });
  
  // Use the result from the second pass which handles cycles better
  return result2.reverse();
}

module.exports = {
  parseEntityFile,
  parseEntityDirectory,
  buildDependencyGraph,
  topologicalSort
};
