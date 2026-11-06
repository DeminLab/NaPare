#!/bin/bash

set -e

echo "Starting database migrations..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Run migrations using the backend's typeorm script
echo "Running migrations..."
pnpm --filter @napare/backend typeorm:migration:run

echo "Migrations completed successfully!"
