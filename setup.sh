#!/usr/bin/env bash
set -e

echo "Installing dependencies..."
npm install

echo "Installing Playwright browsers..."
npx playwright install

echo "Building TypeScript and UI assets..."
npm run build

echo "Creating data directories..."
mkdir -p ./data/media
mkdir -p ./exports

echo "Setup complete."
