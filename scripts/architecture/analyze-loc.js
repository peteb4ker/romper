#!/usr/bin/env node

/**
 * Lines of Code (LOC) Analysis Script
 * 
 * Analyzes component complexity based on LOC with updated architectural standards:
 * - Small Components (50-100 LOC): presentational, form inputs, UI elements
 * - Medium Components (100-200 LOC): feature-rich forms, data display, container components  
 * - Large Components (200-300 LOC): complex forms, data tables, multi-step wizards
 * - Red Flags (300+ LOC): multiple responsibilities, missing abstractions
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  extensions: ['.tsx', '.ts'],
  excludeDirs: ['node_modules', 'dist', '.git', 'coverage', '__tests__', 'test', 'worktrees'],
  excludeFiles: ['.test.', '.spec.', '.d.ts'],
  
  // LOC thresholds based on updated standards
  thresholds: {
    small: { min: 50, max: 100 },
    medium: { min: 101, max: 200 },
    large: { min: 201, max: 300 },
    redFlag: { min: 301, max: Infinity }
  },
  
  // Exception files that cannot be decomposed due to architectural constraints
  exceptions: [
    'electron/preload/index.ts', // Must be single file for Electron preload script
  ]
};

// Component categories
const CATEGORIES = {
  small: 'Small Components (50-100 LOC)',
  medium: 'Medium Components (100-200 LOC)', 
  large: 'Large Components (200-300 LOC)',
  redFlag: 'Red Flags (300+ LOC)',
  exception: 'Exceptions (300+ LOC - Architectural Constraints)',
  tiny: 'Tiny Files (<50 LOC)'
};

/**
 * Count non-empty lines in a file
 */
function countLines(content) {
  return content
    .split('\n')
    .filter(line => line.trim() !== '' && !line.trim().startsWith('//'))
    .length;
}

/**
 * Determine file category based on LOC
 */
function categorizeFile(loc, relativePath) {
  // Check if file is in exceptions list
  const isException = CONFIG.exceptions.some(exception => relativePath.includes(exception));
  
  if (loc < CONFIG.thresholds.small.min) return 'tiny';
  if (loc >= CONFIG.thresholds.small.min && loc <= CONFIG.thresholds.small.max) return 'small';
  if (loc >= CONFIG.thresholds.medium.min && loc <= CONFIG.thresholds.medium.max) return 'medium';
  if (loc >= CONFIG.thresholds.large.min && loc <= CONFIG.thresholds.large.max) return 'large';
  
  // If file exceeds threshold but is an exception, mark as 'exception' instead of 'redFlag'
  if (isException) return 'exception';
  return 'redFlag';
}

/**
 * Recursively find all TypeScript/React files
 */
async function findFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(CONFIG.rootDir, fullPath);
    
    // Skip excluded directories
    if (entry.isDirectory()) {
      if (!CONFIG.excludeDirs.some(exclude => entry.name === exclude || relativePath.includes(exclude))) {
        await findFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      // Include files with matching extensions, exclude test files
      const hasValidExtension = CONFIG.extensions.some(ext => entry.name.endsWith(ext));
      const isExcluded = CONFIG.excludeFiles.some(exclude => entry.name.includes(exclude));
      
      if (hasValidExtension && !isExcluded) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Analyze files and generate LOC report
 */
async function analyzeLOC() {
  console.log('🔍 Analyzing Lines of Code (LOC) for architectural compliance...\n');
  
  const files = await findFiles(CONFIG.rootDir);
  const results = {
    files: [],
    categories: {
      tiny: [],
      small: [],
      medium: [],
      large: [],
      redFlag: [],
      exception: []
    },
    stats: {
      totalFiles: 0,
      totalLines: 0,
      averageLines: 0
    }
  };
  
  // Analyze each file
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const loc = countLines(content);
      const relativePath = path.relative(CONFIG.rootDir, file);
      const category = categorizeFile(loc, relativePath);
      
      const fileInfo = {
        path: relativePath,
        loc,
        category,
        isComponent: file.endsWith('.tsx'),
        isHook: relativePath.includes('/hooks/') || path.basename(file).startsWith('use')
      };
      
      results.files.push(fileInfo);
      results.categories[category].push(fileInfo);
      results.stats.totalLines += loc;
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${file}: ${error.message}`);
    }
  }
  
  results.stats.totalFiles = results.files.length;
  results.stats.averageLines = Math.round(results.stats.totalLines / results.stats.totalFiles);
  
  return results;
}

/**
 * Generate detailed report
 */
function generateReport(results) {
  console.log('📊 LOC Analysis Results');
  console.log('='.repeat(50));
  console.log(`Total Files Analyzed: ${results.stats.totalFiles}`);
  console.log(`Total Lines of Code: ${results.stats.totalLines.toLocaleString()}`);
  console.log(`Average LOC per File: ${results.stats.averageLines}`);
  console.log('');
  
  // Category breakdown
  console.log('📂 File Distribution by Category:');
  console.log('-'.repeat(40));
  
  Object.entries(results.categories).forEach(([key, files]) => {
    const percentage = ((files.length / results.stats.totalFiles) * 100).toFixed(1);
    const avgLoc = files.length > 0 ? Math.round(files.reduce((sum, f) => sum + f.loc, 0) / files.length) : 0;
    
    console.log(`${CATEGORIES[key]}: ${files.length} files (${percentage}%)`);
    if (files.length > 0) {
      console.log(`  Average LOC: ${avgLoc}`);
    }
  });
  console.log('');
  
  // Red flags - files that need refactoring
  if (results.categories.redFlag.length > 0) {
    console.log('🚨 RED FLAGS - Files Exceeding 300 LOC:');
    console.log('-'.repeat(40));
    
    const sortedRedFlags = results.categories.redFlag.sort((a, b) => b.loc - a.loc);
    sortedRedFlags.forEach(file => {
      const type = file.isComponent ? '(Component)' : file.isHook ? '(Hook)' : '(Utility)';
      console.log(`  ${file.loc} LOC - ${file.path} ${type}`);
    });
    console.log('');
    console.log('💡 Consider refactoring these files by:');
    console.log('   - Breaking into smaller components');
    console.log('   - Extracting custom hooks');
    console.log('   - Moving business logic to utility functions');
    console.log('   - Separating concerns into multiple files');
    console.log('');
  }
  
  // Architectural exceptions - files that cannot be decomposed
  if (results.categories.exception.length > 0) {
    console.log('⚠️  ARCHITECTURAL EXCEPTIONS - Large Files with Constraints:');
    console.log('-'.repeat(55));
    
    const sortedExceptions = results.categories.exception.sort((a, b) => b.loc - a.loc);
    sortedExceptions.forEach(file => {
      const type = file.isComponent ? '(Component)' : file.isHook ? '(Hook)' : '(Utility)';
      console.log(`  ${file.loc} LOC - ${file.path} ${type} - CANNOT BE SPLIT`);
    });
    console.log('');
    console.log('💡 These files exceed 300 LOC but cannot be decomposed due to:');
    console.log('   - Electron preload script requirements');
    console.log('   - Single-file architectural constraints');
    console.log('   - Framework-specific limitations');
    console.log('');
  }
  
  // Components vs Hooks analysis
  const components = results.files.filter(f => f.isComponent);
  const hooks = results.files.filter(f => f.isHook);
  
  console.log('⚛️  React Components Analysis:');
  console.log('-'.repeat(30));
  console.log(`Total Components: ${components.length}`);
  const avgComponentLoc = components.length > 0 ? Math.round(components.reduce((sum, c) => sum + c.loc, 0) / components.length) : 0;
  console.log(`Average Component LOC: ${avgComponentLoc}`);
  
  const largeComponents = components.filter(c => c.loc > 200);
  if (largeComponents.length > 0) {
    console.log(`Large Components (200+ LOC): ${largeComponents.length}`);
  }
  console.log('');
  
  console.log('🪝 Custom Hooks Analysis:');
  console.log('-'.repeat(25));
  console.log(`Total Hooks: ${hooks.length}`);
  const avgHookLoc = hooks.length > 0 ? Math.round(hooks.reduce((sum, h) => sum + h.loc, 0) / hooks.length) : 0;
  console.log(`Average Hook LOC: ${avgHookLoc}`);
  
  const largeHooks = hooks.filter(h => h.loc > 200);
  if (largeHooks.length > 0) {
    console.log(`Large Hooks (200+ LOC): ${largeHooks.length}`);
  }
  console.log('');
  
  // Architectural health score (exceptions don't count as penalties)
  const redFlagPenalty = results.categories.redFlag.length * 10;
  const largePenalty = results.categories.large.length * 2;
  const healthScore = Math.max(0, 100 - redFlagPenalty - largePenalty);
  
  // Report exceptions separately
  const exceptionCount = results.categories.exception.length;
  
  console.log('🏥 Architectural Health Score:');
  console.log('-'.repeat(30));
  console.log(`Score: ${healthScore}/100`);
  if (exceptionCount > 0) {
    console.log(`Exceptions: ${exceptionCount} files (architectural constraints - not penalized)`);
  }
  
  if (healthScore >= 90) {
    console.log('✅ Excellent architectural health');
  } else if (healthScore >= 80) {
    console.log('🟡 Good architectural health with room for improvement');
  } else if (healthScore >= 70) {
    console.log('🟠 Fair architectural health - consider refactoring');
  } else {
    console.log('🔴 Poor architectural health - immediate refactoring needed');
  }
}

/**
 * Save results to JSON for further analysis
 */
async function saveResults(results) {
  const outputDir = path.join(CONFIG.rootDir, 'reports');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'loc-analysis.json');
  await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${path.relative(CONFIG.rootDir, outputFile)}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await analyzeLOC();
    generateReport(results);
    await saveResults(results);
  } catch (error) {
    console.error('❌ Error during LOC analysis:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeLOC, generateReport };