#!/usr/bin/env node

/**
 * Master Architectural Analysis Script
 * 
 * Runs all architectural analyses and generates comprehensive reports
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run a script and return a promise
 */
function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 ${description}...`);
    
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..')
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${description} failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🏗️  Running Comprehensive Architectural Analysis');
  console.log('='.repeat(50));
  console.log('');
  
  try {
    // Run all analyses in sequence
    await runScript(
      path.join(__dirname, 'analyze-loc.js'),
      'Analyzing Lines of Code (LOC) compliance'
    );
    
    await runScript(
      path.join(__dirname, 'analyze-dependencies.js'),
      'Analyzing dependency architecture'
    );
    
    await runScript(
      path.join(__dirname, 'analyze-complexity.js'), 
      'Analyzing component complexity metrics'
    );
    
    await runScript(
      path.join(__dirname, 'generate-report.js'),
      'Generating comprehensive assessment report'
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log('✅ Architectural analysis completed successfully!');
    console.log(`⏱️  Total time: ${duration}s`);
    console.log('');
    console.log('📁 Generated Reports:');
    console.log('  reports/loc-analysis.json');
    console.log('  reports/dependency-analysis.json'); 
    console.log('  reports/complexity-analysis.json');
    console.log('  reports/architectural-summary.json (for agents)');
    console.log('  reports/architectural-assessment.md (detailed)');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('  1. Review architectural-assessment.md for detailed findings');
    console.log('  2. Address critical issues identified in the report');
    console.log('  3. Set up pre-commit hooks for ongoing quality gates');
    console.log('  4. Consider integrating into CI/CD pipeline');
    
  } catch (error) {
    console.error('❌ Architectural analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runScript };