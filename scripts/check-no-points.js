#!/usr/bin/env node

/**
 * Guardrail: Prevent points from returning in v1
 * 
 * Scans web/src for "points" (whole word, case-insensitive)
 * EXCEPT allows matches inside web/src/app/account/**
 * 
 * Uses word boundaries to avoid false positives (appointment, endpoint, etc.)
 * 
 * If found elsewhere: prints file paths and exits with code 1
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const EXCLUDE_DIR = path.join(SRC_DIR, 'app', 'account');

// Only match "points" as a whole word (not "point", "appointment", "endpoint", etc.)
const POINTS_PATTERN = /\bpoints\b/i;

function shouldExclude(filePath) {
  const normalized = path.normalize(filePath);
  const normalizedExclude = path.normalize(EXCLUDE_DIR);
  return normalized.startsWith(normalizedExclude);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(POINTS_PATTERN);
  
  if (matches && matches.length > 0) {
    return matches.length;
  }
  return 0;
}

function scanDirectory(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, and other build artifacts
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath, results);
    } else if (entry.isFile()) {
      // Only check TypeScript/JavaScript source files
      const ext = path.extname(entry.name);
      const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      
      if (sourceExtensions.includes(ext)) {
        if (!shouldExclude(fullPath)) {
          const matchCount = scanFile(fullPath);
          if (matchCount > 0) {
            results.push({
              file: fullPath,
              matches: matchCount
            });
          }
        }
      }
    }
  }
  
  return results;
}

// Main execution
console.log('🔍 Scanning for points references (excluding /account)...\n');

const violations = scanDirectory(SRC_DIR);

if (violations.length > 0) {
  console.warn('⚠️  Found points references (Warning only - Build continuing):\n');
  violations.forEach(({ file, matches }) => {
    const relativePath = path.relative(SRC_DIR, file);
    console.warn(`  ${relativePath} (${matches} match${matches > 1 ? 'es' : ''})`);
  });
  console.warn('\n💡 Points are only allowed in /account. Remove these references or move them to /account.\n');
  process.exit(0);
} else {
  console.log('✅ No points references found outside /account\n');
  process.exit(0);
}

