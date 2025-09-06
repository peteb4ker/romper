#!/usr/bin/env node

/**
 * Dependency Analysis Script
 * 
 * Analyzes import/export patterns, circular dependencies, and architectural boundaries
 * using madge and custom AST parsing.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import madge from 'madge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  extensions: ['.ts', '.tsx'],
  
  // Define architectural boundaries
  domains: {
    'renderer/components': ['hooks', 'dialogs', 'shared', 'utils', 'wizard'],
    'renderer/hooks': ['kit-management', 'sample-management', 'shared', 'voice-panels'],
    'renderer/utils': [],
    'renderer/views': [],
    'electron/main': ['db', 'services'],
    'shared': ['db'],
  },
  
  // Rules for cross-domain imports
  allowedCrossDomainImports: [
    'shared -> *', // shared can be imported by anyone
    'renderer/components -> renderer/hooks',
    'renderer/components -> renderer/utils', 
    'renderer/components -> shared',
    'renderer/hooks -> renderer/utils',
    'renderer/hooks -> shared',
    'renderer/views -> renderer/components',
    'renderer/views -> renderer/hooks',
    'renderer/views -> renderer/utils',
    'electron/main -> shared'
  ]
};

/**
 * Analyze circular dependencies using madge
 */
async function analyzeCircularDependencies() {
  console.log('🔄 Analyzing circular dependencies...');
  
  try {
    const result = await madge(CONFIG.rootDir, {
      extensions: CONFIG.extensions,
      excludePattern: /(__tests__|\.test\.|\.spec\.|node_modules|dist|coverage|worktrees)/,
      tsConfig: path.join(CONFIG.rootDir, 'tsconfig.json')
    });
    
    const circular = result.circular();
    
    return {
      hasCircularDependencies: circular.length > 0,
      circularDependencies: circular,
      totalModules: result.obj().length || 0
    };
  } catch (error) {
    console.warn('⚠️  Could not analyze circular dependencies:', error.message);
    return {
      hasCircularDependencies: false,
      circularDependencies: [],
      totalModules: 0,
      error: error.message
    };
  }
}

/**
 * Analyze dependency tree depth and patterns
 */
async function analyzeDependencyDepth() {
  console.log('📏 Analyzing dependency depth...');
  
  try {
    const result = await madge(CONFIG.rootDir, {
      extensions: CONFIG.extensions,
      excludePattern: /(__tests__|\.test\.|\.spec\.|node_modules|dist|coverage|worktrees)/,
      tsConfig: path.join(CONFIG.rootDir, 'tsconfig.json')
    });
    
    const tree = result.obj();
    const depthAnalysis = {};
    
    // Calculate dependency depth for each module
    Object.keys(tree).forEach(module => {
      const depth = calculateMaxDepth(module, tree, new Set());
      const relativePath = path.relative(CONFIG.rootDir, module);
      depthAnalysis[relativePath] = {
        depth,
        dependencies: tree[module]?.length || 0,
        directDeps: tree[module] || []
      };
    });
    
    return depthAnalysis;
  } catch (error) {
    console.warn('⚠️  Could not analyze dependency depth:', error.message);
    return {};
  }
}

/**
 * Calculate maximum dependency depth recursively
 */
function calculateMaxDepth(module, tree, visited) {
  if (visited.has(module)) return 0; // Avoid infinite loops
  visited.add(module);
  
  const deps = tree[module] || [];
  if (deps.length === 0) return 1;
  
  const childDepths = deps.map(dep => calculateMaxDepth(dep, tree, new Set(visited)));
  return 1 + Math.max(...childDepths, 0);
}

/**
 * Analyze architectural boundary violations
 */
async function analyzeArchitecturalBoundaries() {
  console.log('🏗️  Analyzing architectural boundaries...');
  
  const violations = [];
  const domainStats = {};
  
  try {
    const result = await madge(CONFIG.rootDir, {
      extensions: CONFIG.extensions,
      excludePattern: /(__tests__|\.test\.|\.spec\.|node_modules|dist|coverage|worktrees)/,
      tsConfig: path.join(CONFIG.rootDir, 'tsconfig.json')
    });
    
    const tree = result.obj();
    
    Object.entries(tree).forEach(([modulePath, dependencies]) => {
      const moduleRelative = path.relative(CONFIG.rootDir, modulePath);
      const moduleDomain = identifyDomain(moduleRelative);
      
      // Initialize domain stats
      if (!domainStats[moduleDomain]) {
        domainStats[moduleDomain] = {
          modules: 0,
          dependencies: 0,
          crossDomainImports: 0
        };
      }
      domainStats[moduleDomain].modules++;
      domainStats[moduleDomain].dependencies += dependencies.length;
      
      dependencies.forEach(depPath => {
        const depRelative = path.relative(CONFIG.rootDir, depPath);
        const depDomain = identifyDomain(depRelative);
        
        if (moduleDomain !== depDomain) {
          domainStats[moduleDomain].crossDomainImports++;
          
          const importRule = `${moduleDomain} -> ${depDomain}`;
          const isAllowed = isImportAllowed(moduleDomain, depDomain);
          
          if (!isAllowed) {
            violations.push({
              from: moduleRelative,
              to: depRelative,
              fromDomain: moduleDomain,
              toDomain: depDomain,
              rule: importRule
            });
          }
        }
      });
    });
    
    return {
      violations,
      domainStats,
      totalViolations: violations.length
    };
  } catch (error) {
    console.warn('⚠️  Could not analyze architectural boundaries:', error.message);
    return {
      violations: [],
      domainStats: {},
      totalViolations: 0,
      error: error.message
    };
  }
}

/**
 * Identify which architectural domain a file belongs to
 */
function identifyDomain(filePath) {
  for (const [domain, subdomains] of Object.entries(CONFIG.domains)) {
    if (filePath.includes(domain)) {
      // Check for subdomain match
      for (const subdomain of subdomains) {
        if (filePath.includes(`${domain}/${subdomain}`)) {
          return `${domain}/${subdomain}`;
        }
      }
      return domain;
    }
  }
  return 'unknown';
}

/**
 * Check if cross-domain import is allowed
 */
function isImportAllowed(fromDomain, toDomain) {
  // Same domain is always allowed
  if (fromDomain === toDomain) return true;
  
  // Check allowed rules
  for (const rule of CONFIG.allowedCrossDomainImports) {
    const [from, to] = rule.split(' -> ');
    if (from === '*' || fromDomain.includes(from)) {
      if (to === '*' || toDomain.includes(to)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Generate dependency analysis report
 */
function generateDependencyReport(circularResult, depthAnalysis, boundaryAnalysis) {
  console.log('\n📊 Dependency Analysis Results');
  console.log('='.repeat(50));
  
  // Circular dependencies
  console.log('🔄 Circular Dependencies:');
  console.log('-'.repeat(30));
  if (circularResult.hasCircularDependencies) {
    console.log(`❌ Found ${circularResult.circularDependencies.length} circular dependency chains:`);
    circularResult.circularDependencies.forEach((cycle, index) => {
      console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
    });
  } else {
    console.log('✅ No circular dependencies found');
  }
  console.log(`Total modules analyzed: ${circularResult.totalModules}`);
  console.log('');
  
  // Dependency depth analysis
  console.log('📏 Dependency Depth Analysis:');
  console.log('-'.repeat(35));
  
  const depthEntries = Object.entries(depthAnalysis);
  if (depthEntries.length > 0) {
    const avgDepth = depthEntries.reduce((sum, [, data]) => sum + data.depth, 0) / depthEntries.length;
    const maxDepth = Math.max(...depthEntries.map(([, data]) => data.depth));
    const deepFiles = depthEntries.filter(([, data]) => data.depth > 8).sort((a, b) => b[1].depth - a[1].depth);
    
    console.log(`Average dependency depth: ${avgDepth.toFixed(1)}`);
    console.log(`Maximum dependency depth: ${maxDepth}`);
    
    if (deepFiles.length > 0) {
      console.log(`\n⚠️  Files with deep dependency chains (>8 levels):`);
      deepFiles.slice(0, 10).forEach(([file, data]) => {
        console.log(`  ${data.depth} levels - ${file}`);
      });
    }
  }
  console.log('');
  
  // Architectural boundary analysis
  console.log('🏗️  Architectural Boundary Analysis:');
  console.log('-'.repeat(40));
  
  if (boundaryAnalysis.totalViolations > 0) {
    console.log(`❌ Found ${boundaryAnalysis.totalViolations} architectural boundary violations:`);
    
    // Group violations by rule
    const violationsByRule = {};
    boundaryAnalysis.violations.forEach(violation => {
      if (!violationsByRule[violation.rule]) {
        violationsByRule[violation.rule] = [];
      }
      violationsByRule[violation.rule].push(violation);
    });
    
    Object.entries(violationsByRule).forEach(([rule, violations]) => {
      console.log(`\n  ${rule}: ${violations.length} violations`);
      violations.slice(0, 5).forEach(violation => {
        console.log(`    ${violation.from} → ${violation.to}`);
      });
      if (violations.length > 5) {
        console.log(`    ... and ${violations.length - 5} more`);
      }
    });
  } else {
    console.log('✅ No architectural boundary violations found');
  }
  
  // Domain statistics
  console.log('\n📂 Domain Statistics:');
  console.log('-'.repeat(25));
  Object.entries(boundaryAnalysis.domainStats).forEach(([domain, stats]) => {
    const avgDepsPerModule = stats.modules > 0 ? (stats.dependencies / stats.modules).toFixed(1) : 0;
    console.log(`${domain}:`);
    console.log(`  Modules: ${stats.modules}`);
    console.log(`  Avg deps/module: ${avgDepsPerModule}`);
    console.log(`  Cross-domain imports: ${stats.crossDomainImports}`);
  });
  
  // Dependency health score
  let healthScore = 100;
  
  // Penalize circular dependencies heavily
  healthScore -= circularResult.circularDependencies.length * 20;
  
  // Penalize boundary violations
  healthScore -= boundaryAnalysis.totalViolations * 5;
  
  // Penalize deep dependency chains
  const deepFileCount = Object.values(depthAnalysis).filter(data => data.depth > 8).length;
  healthScore -= deepFileCount * 2;
  
  healthScore = Math.max(0, healthScore);
  
  console.log('\n🏥 Dependency Health Score:');
  console.log('-'.repeat(30));
  console.log(`Score: ${healthScore}/100`);
  
  if (healthScore >= 90) {
    console.log('✅ Excellent dependency architecture');
  } else if (healthScore >= 80) {
    console.log('🟡 Good dependency architecture with minor issues');
  } else if (healthScore >= 70) {
    console.log('🟠 Fair dependency architecture - consider improvements');
  } else {
    console.log('🔴 Poor dependency architecture - immediate attention needed');
  }
  
  return { healthScore, circularResult, depthAnalysis, boundaryAnalysis };
}

/**
 * Save dependency analysis results
 */
async function saveDependencyResults(results) {
  const outputDir = path.join(CONFIG.rootDir, 'reports');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'dependency-analysis.json');
  await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${path.relative(CONFIG.rootDir, outputFile)}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Analyzing dependency architecture...\n');
    
    // Run all analyses in parallel for better performance
    const [circularResult, depthAnalysis, boundaryAnalysis] = await Promise.all([
      analyzeCircularDependencies(),
      analyzeDependencyDepth(),
      analyzeArchitecturalBoundaries()
    ]);
    
    const report = generateDependencyReport(circularResult, depthAnalysis, boundaryAnalysis);
    
    await saveDependencyResults({
      ...report,
      timestamp: new Date().toISOString(),
      config: CONFIG
    });
    
  } catch (error) {
    console.error('❌ Error during dependency analysis:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeCircularDependencies, analyzeDependencyDepth, analyzeArchitecturalBoundaries };