# Setup Data - User Guide

This guide is designed for non-developer users who need to work with the Setup Data tool to manage database content for the IGS Pharma application.

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Basic Concepts](#basic-concepts)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

## Introduction

Setup Data is a tool that helps you manage data in your IGS Pharma database. It allows you to:

- Import data from JSON files into your database
- Convert data between different formats
- Validate data against your application's requirements
- Generate test data for development or training purposes

## Installation

The Setup Data tool is already included in your IGS Pharma application. You don't need to install anything separately.

## Basic Concepts

### Configuration File

The configuration file (`setup-data.yml`) contains all the settings needed to connect to your database and API. This file should already be set up for you, but you might need to update database credentials if they change.

### JSON Data Files

Data is typically stored in JSON files with a specific structure. These files contain records that will be imported into your database tables.

### Commands

You interact with the Setup Data tool using commands. The most common commands are:

- `init`: Create a new configuration file
- `convert`: Convert data between different formats
- `validate`: Check if your data matches the required format
- `import`: Add data to your database

## Common Tasks

### Importing Products into the Database

1. Make sure your backend application is running
2. Open a command prompt in your IGS Pharma folder
3. Run the following command:

```bash
pnpm setup-data import -f products-pascal.json -t Products
```

This will import all products from the file into your Products table.

### Converting Data to the Correct Format

If you have data in a different format (like camelCase), you can convert it to PascalCase (required by the database):

```bash
pnpm setup-data convert -f your-data.json -o your-data-pascal.json -c pascal
```

### Validating Data Before Import

To check if your data is valid before importing:

```bash
pnpm setup-data validate -f your-data.json -s backend/src/IGS.Domain/Entities/YourEntity.cs
```

### Creating a New Configuration File

If you need to create a new configuration file:

```bash
pnpm setup-data init -p your-config.yml
```

Then edit the file to add your database connection details.

## Troubleshooting

### Common Errors

#### "Unknown database" Error

This means the database name in your configuration file doesn't match your actual database. Edit the `setup-data.yml` file and update the database name.

#### "Field doesn't have a default value" Error

This happens when your data is missing required fields. Make sure your JSON file includes all required fields for the table you're importing into.

#### Connection Errors

If you see connection errors, check that:

1. Your backend application is running
2. Database credentials in `setup-data.yml` are correct
3. You're connected to the network

### Getting Help

If you encounter issues not covered in this guide, please contact your system administrator or the development team for assistance.

## Advanced Usage

### Importing Only Specific Records

To import just one record from your file:

```bash
pnpm setup-data import -f your-data.json -t YourTable -i 0
```

The `-i 0` means "import only the first record" (counting starts from 0).

### Overriding Category IDs

If you need to assign all imported items to a specific category:

```bash
pnpm setup-data import -f your-data.json -t Products --override-category 1
```

This will set all products' CategoryId to 1, regardless of what's in the file.
