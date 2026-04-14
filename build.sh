#!/bin/bash
echo "Building..."
tsc
mkdir -p dist/generator/config
mkdir -p dist/generator/templates
cp src/config.json5 dist/
cp src/generator/config/*.json5 dist/generator/config/
cp src/generator/templates/*.njk dist/generator/templates/
