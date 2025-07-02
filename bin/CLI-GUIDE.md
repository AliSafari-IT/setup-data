# Setup Data CLI Guide

A comprehensive tool for populating database tables with real or mock data, with support for MySQL databases, API endpoints, and C# model classes.

## Installation

```bash
# Install globally
pnpm install -g setup-data

# Or use directly from the project
pnpm exec setup-data
```

## Configuration

Create a configuration file using the init command:

```bash
setup-data init
```

This will create a `setup-data.yml` file in your current directory with the following structure:

```yaml
# API Configuration
api:
  baseUrl: http://localhost:5000/api
  auth:
    type: bearer
    token: your_token_here

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

## CLI Commands Overview

### Import Data

Import data from a JSON file to a database table or API endpoint.

```bash
setup-data import --file <path> --table <name> [options]
```

**Required Options:**

- `-f, --file <path>`: Path to the JSON file containing the data
- `-t, --table <name>`: Name of the table or entity to import data into

**Additional Options:**

- `-s, --schema <path>`: Path to the schema file (C#, TypeScript, or JSON)
- `-c, --config <path>`: Path to the configuration file (default: ./setup-data.yml)
- `-i, --index <number>`: Import only the item at the specified index
- `--override-category <id>`: Override all CategoryId values with the specified ID

**Examples:**

```bash
# Import all products from a JSON file
setup-data import --file products.json --table Products

# Import with schema validation
setup-data import --file products.json --table Products --schema models/Product.cs

# Import a single product
setup-data import --file products.json --table Products --index 0

# Override category IDs
setup-data import --file products.json --table Products --override-category 1
```

### Generate Mock Data

Generate mock data based on a schema and optionally import it.

```bash
setup-data generate --table <name> --schema <path> [options]
```

**Required Options:**

- `-t, --table <name>`: Name of the table or entity to generate data for
- `-s, --schema <path>`: Path to the schema file (C#, TypeScript, or JSON)

**Additional Options:**

- `-n, --count <number>`: Number of items to generate (default: 10)
- `-o, --output <path>`: Path to save the generated data (if not specified, data will be imported)
- `-c, --config <path>`: Path to the configuration file (default: ./setup-data.yml)
- `--seed <number>`: Seed for the random data generator

**Examples:**

```bash
# Generate 50 mock products and import them
setup-data generate --table Products --schema models/Product.cs --count 50

# Generate mock data and save to file without importing
setup-data generate --table Products --schema models/Product.cs --count 20 --output mock-products.json

# Use a specific seed for reproducible data
setup-data generate --table Products --schema models/Product.cs --seed 12345
```

### Validate Data

Validate data against a schema without importing.

```bash
setup-data validate --file <path> --schema <path>
```

**Required Options:**

- `-f, --file <path>`: Path to the JSON file containing the data
- `-s, --schema <path>`: Path to the schema file (C#, TypeScript, or JSON)

**Examples:**

```bash
# Validate products data against a C# model
setup-data validate --file products.json --schema models/Product.cs
```

### Initialize Configuration

Create a new configuration file.

```bash
setup-data init [options]
```

**Options:**

- `-p, --path <path>`: Path to create the configuration file (default: ./setup-data.yml)

**Examples:**

```bash
# Create a configuration file in the current directory
setup-data init

# Create a configuration file in a specific location
setup-data init --path config/database-setup.yml
```

### Convert Case Styles

Convert property names in a JSON file to a different case style.

```bash
setup-data convert --file <path> --output <path> --case <style>
```

**Required Options:**

- `-f, --file <path>`: Path to the JSON file to convert
- `-o, --output <path>`: Path to save the converted JSON file
- `-c, --case <style>`: Case style to convert to (pascal, camel, snake, kebab)

**Examples:**

```bash
# Convert JSON properties to PascalCase
setup-data convert --file input.json --output output.json --case pascal

# Convert JSON properties to snake_case
setup-data convert --file input.json --output output.json --case snake
```

## Schema Support

The tool supports multiple schema formats:

1. **C# Classes**: Parse C# model classes to extract schema information

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

2. **TypeScript Interfaces**: Parse TypeScript interfaces for schema information

   ```typescript
   interface Product {
       id?: number;
       name: string;
       price: number;
       categoryId: number;
   }
   ```

3. **JSON Schema**: Use standard JSON Schema format

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

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure your database credentials in `setup-data.yml` are correct
   - Check that the MySQL server is running

2. **API Connection Errors**
   - Verify the API endpoint is accessible
   - Check authentication credentials if the API requires authentication

3. **Schema Parsing Errors**
   - Ensure the C# or TypeScript file has the correct syntax
   - Check that the class or interface is properly defined

### Debug Mode

Enable debug mode for more detailed logs:

```bash
DEBUG=true setup-data import --file products.json --table Products
```

## Advanced Usage

### Using Environment Variables

You can use environment variables in your configuration file:

```yaml
database:
  password: ${DB_PASSWORD}
  user: ${DB_USER}
```

### Transaction Support

By default, API imports are not transactional (they don't roll back on failure). To enable transactional behavior:

```yaml
api:
  transactional: true
```

For database imports, transactions are always enabled and will roll back on failure.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
