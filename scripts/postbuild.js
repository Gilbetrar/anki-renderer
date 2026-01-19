#!/usr/bin/env node
/**
 * Post-build script for anki-renderer package
 *
 * This script:
 * 1. Removes .gitignore files from pkg/ and pkg-node/ (wasm-pack creates them)
 * 2. Transforms import paths in dist/ files from ../../pkg to ../pkg
 *    (needed because source is in js/src/ but compiled output is in dist/)
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';

// Remove .gitignore files that wasm-pack creates
const gitignoreFiles = ['pkg/.gitignore', 'pkg-node/.gitignore'];
for (const file of gitignoreFiles) {
  if (existsSync(file)) {
    unlinkSync(file);
    console.log(`Removed ${file}`);
  }
}

// Transform import paths in dist files
// Source paths: ../../pkg/ and ../../pkg-node/ (relative to js/src/)
// Need to become: ../pkg/ and ../pkg-node/ (relative to dist/)
const distFiles = ['dist/index.js', 'dist/index.js.map'];
for (const file of distFiles) {
  if (existsSync(file)) {
    let content = readFileSync(file, 'utf8');
    const originalContent = content;

    // Replace ../../pkg with ../pkg (and ../../pkg-node with ../pkg-node)
    content = content.replace(/\.\.\/\.\.\/pkg/g, '../pkg');

    if (content !== originalContent) {
      writeFileSync(file, content);
      console.log(`Transformed paths in ${file}`);
    }
  }
}

console.log('Postbuild complete');
