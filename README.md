# Setup Data

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful and flexible tool for populating database tables with real or mock data. This package supports MySQL databases, REST APIs, and includes smart schema parsing from C# model classes.

## Features

- **Multiple Data Sources**: Import from JSON files or generate mock data
- **MySQL Support**: Direct database connection with transaction support
- **API Integration**: REST API support with authentication
- **Schema Parsing**: Parse C#, TypeScript, or JSON schemas
- **Mock Data Generation**: Generate realistic mock data using Faker.js
- **Case Conversion**: Transform between different case styles (camelCase, PascalCase, etc.)
- **CLI Interface**: Easy-to-use command line interface
- **Validation**: Validate data against schemas before import

## Installation

```bash
# Install globally
pnpm install -g setup-data

# Or add to your project
pnpm add setup-data
```

## Quick Start

### Importing Data

```javascript
const { setupData } = require('setup-data');

// Import data from a JSON file
setupData({
  importFile: './data/products.json',
  tableName: 'Products',
  schemaPath: './models/Product.cs'
});
```

### Generating Mock Data

```javascript
const { setupData } = require('setup-data');

// Generate and import mock data
setupData({
  generateMock: true,
  schemaPath: './models/Product.cs',
  tableName: 'Products',
  count: 50
});
```

### Using the CLI

```bash
# Import data
setup-data import --file products.json --table Products

# Generate mock data
setup-data generate --table Products --schema models/Product.cs --count 50

# Convert case styles
setup-data convert --file input.json --output output.json --case pascal
```

## Configuration

Create a configuration file using the init command:

```bash
setup-data init
```

This will create a `setup-data.yml` file with the following structure:

```yaml
# API Configuration
api:
  baseUrl: http://localhost:5000/api
  auth:
    type: bearer
    token: your_token_here
  transactional: true

# Database Configuration
database:
  useDirectConnection: false
  host: localhost
  port: 3306
  user: root
  password: your_password_here
  database: your_database_name

# Data Transformation Options
transform:
  casing: pascal
```

## Schema Support

The package supports multiple schema formats:

### C# Classes

```csharp
public class Product
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; }
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
}
```

### TypeScript Interfaces

```typescript
interface Product {
    id?: number;
    name: string;
    price: number;
    categoryId: number;
}
```

### JSON Schema

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" },
    "price": { "type": "number" },
    "categoryId": { "type": "integer" }
  },
  "required": ["name", "price", "categoryId"]
}
```

## API Reference

### setupData(options)

Main function to setup data.

**Options:**

- `importFile`: Path to the JSON file to import
- `tableName`: Name of the table or entity
- `schemaPath`: Path to the schema file
- `configPath`: Path to the configuration file
- `generateMock`: Set to true to generate mock data
- `count`: Number of mock items to generate
- `seed`: Seed for the random data generator
- `overrides`: Object with field overrides

### transformData(data, options)

Transform data according to provided options.

**Options:**

- `casing`: Case style to transform to ('pascal', 'camel', 'snake', 'kebab')

### generateMockData(options)

Generate mock data based on a schema.

**Options:**

- `schemaPath`: Path to the schema file
- `count`: Number of items to generate
- `tableName`: Table/entity name
- `fakerSeed`: Seed for Faker.js

## Documentation

- [User Guide for Non-Developers](./USERS-GUIDE.md): A comprehensive guide for non-technical users
- [CLI Commands Reference](./bin/CLI-GUIDE.md): Detailed documentation for all CLI commands

## Advanced Usage

### Transaction Support

By default, API imports are not transactional. To enable transactional behavior:

```yaml
api:
  transactional: true
```

For database imports, transactions are always enabled and will roll back on failure.

### Environment Variables

You can use environment variables in your configuration file:

```yaml
database:
  password: ${DB_PASSWORD}
  user: ${DB_USER}
```

### Custom Field Generators

Specify custom Faker.js generators for specific fields:

```yaml
mock:
  generators:
    productName: commerce.productName
    price: commerce.price
    description: commerce.productDescription
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT