#!/usr/bin/env node

/**
 * Component Complexity Metrics Analyzer
 * 
 * Analyzes React components and custom hooks for architectural complexity including:
 * - Props count and complexity
 * - Hook usage patterns
 * - State management complexity
 * - Conditional rendering patterns
 * - Component composition depth
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@typescript-eslint/typescript-estree';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  
  // Complexity thresholds
  thresholds: {
    props: {
      simple: 5,
      moderate: 10,
      complex: 15
    },
    hooks: {
      simple: 3,
      moderate: 6,
      complex: 10
    },
    conditionals: {
      simple: 5,
      moderate: 10,
      complex: 20
    },
    returnFields: {
      simple: 5,
      moderate: 10,
      complex: 15
    }
  }
};

/**
 * Parse TypeScript/React file and extract AST
 */
async function parseFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parse(content, {
      jsx: true,
      range: true,
      tokens: true,
      comment: true,
      sourceType: 'module'
    });
  } catch (error) {
    return null;
  }
}

/**
 * Extract component props information
 */
function analyzeProps(ast, filePath) {
  const results = [];
  
  function visit(node) {
    // Look for React component function declarations
    if (
      (node.type === 'FunctionDeclaration' || 
       node.type === 'ArrowFunctionExpression' ||
       node.type === 'FunctionExpression') &&
      node.params &&
      node.params.length > 0
    ) {
      const firstParam = node.params[0];
      
      if (firstParam.type === 'ObjectPattern') {
        // Destructured props
        const propCount = firstParam.properties.length;
        const propNames = firstParam.properties.map(prop => {
          if (prop.type === 'Property' && prop.key) {
            return prop.key.name || 'unknown';
          }
          return 'spread';
        });
        
        results.push({
          type: 'component',
          name: node.id ? node.id.name : 'anonymous',
          propCount,
          propNames,
          hasSpreadProps: propNames.includes('spread')
        });
      } else if (firstParam.typeAnnotation) {
        // Typed props interface
        results.push({
          type: 'component',
          name: node.id ? node.id.name : 'anonymous',
          propCount: 'typed', // We'd need more complex analysis for interface props
          propNames: ['typed'],
          hasSpreadProps: false
        });
      }
    }
    
    // Recurse through child nodes
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => {
            if (child && typeof child === 'object') {
              visit(child);
            }
          });
        } else {
          visit(node[key]);
        }
      }
    }
  }
  
  visit(ast);
  return results;
}

/**
 * Analyze hook usage patterns
 */
function analyzeHookUsage(ast) {
  const hookCalls = [];
  const customHooks = [];
  
  function visit(node) {
    // Look for hook calls (functions starting with 'use')
    if (node.type === 'CallExpression' && 
        node.callee && 
        node.callee.name && 
        node.callee.name.startsWith('use')) {
      
      hookCalls.push({
        name: node.callee.name,
        args: node.arguments.length
      });
    }
    
    // Look for custom hook definitions
    if ((node.type === 'FunctionDeclaration' || 
         node.type === 'ArrowFunctionExpression') &&
        node.id && 
        node.id.name && 
        node.id.name.startsWith('use')) {
      
      customHooks.push({
        name: node.id.name,
        params: node.params.length
      });
    }
    
    // Recurse through child nodes
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => {
            if (child && typeof child === 'object') {
              visit(child);
            }
          });
        } else {
          visit(node[key]);
        }
      }
    }
  }
  
  visit(ast);
  
  return {
    hookCalls,
    customHooks,
    totalHooks: hookCalls.length,
    uniqueHooks: [...new Set(hookCalls.map(h => h.name))].length
  };
}

/**
 * Analyze conditional rendering complexity
 */
function analyzeConditionals(ast) {
  let conditionalCount = 0;
  let ternaryCount = 0;
  let logicalExpressions = 0;
  
  function visit(node) {
    if (node.type === 'ConditionalExpression') {
      ternaryCount++;
      conditionalCount++;
    } else if (node.type === 'LogicalExpression' && node.operator === '&&') {
      logicalExpressions++;
      conditionalCount++;
    } else if (node.type === 'IfStatement') {
      conditionalCount++;
    }
    
    // Recurse through child nodes
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => {
            if (child && typeof child === 'object') {
              visit(child);
            }
          });
        } else {
          visit(node[key]);
        }
      }
    }
  }
  
  visit(ast);
  
  return {
    conditionalCount,
    ternaryCount,
    logicalExpressions
  };
}

/**
 * Analyze hook return complexity (for custom hooks)
 */
function analyzeHookReturns(ast) {
  const returns = [];
  
  function visit(node) {
    if (node.type === 'ReturnStatement' && node.argument) {
      if (node.argument.type === 'ObjectExpression') {
        // Object return
        returns.push({
          type: 'object',
          fields: node.argument.properties.length
        });
      } else if (node.argument.type === 'ArrayExpression') {
        // Array return
        returns.push({
          type: 'array',
          fields: node.argument.elements.length
        });
      } else {
        // Simple return
        returns.push({
          type: 'simple',
          fields: 1
        });
      }
    }
    
    // Recurse through child nodes
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => {
            if (child && typeof child === 'object') {
              visit(child);
            }
          });
        } else {
          visit(node[key]);
        }
      }
    }
  }
  
  visit(ast);
  return returns;
}

/**
 * Analyze a single file for complexity metrics
 */
async function analyzeFileComplexity(filePath) {
  const ast = await parseFile(filePath);
  if (!ast) return null;
  
  const relativePath = path.relative(CONFIG.rootDir, filePath);
  const isComponent = filePath.endsWith('.tsx');
  const isHook = relativePath.includes('/hooks/') || path.basename(filePath).startsWith('use');
  
  const props = analyzeProps(ast, filePath);
  const hooks = analyzeHookUsage(ast);
  const conditionals = analyzeConditionals(ast);
  const returns = analyzeHookReturns(ast);
  
  // Calculate complexity scores
  const propComplexity = props.reduce((max, p) => {
    const count = typeof p.propCount === 'number' ? p.propCount : 0;
    return Math.max(max, count);
  }, 0);
  
  const hookComplexity = hooks.totalHooks;
  const conditionalComplexity = conditionals.conditionalCount;
  const returnComplexity = returns.reduce((max, r) => Math.max(max, r.fields), 0);
  
  return {
    path: relativePath,
    isComponent,
    isHook,
    metrics: {
      props: {
        count: propComplexity,
        complexity: categorizeComplexity(propComplexity, CONFIG.thresholds.props)
      },
      hooks: {
        total: hooks.totalHooks,
        unique: hooks.uniqueHooks,
        complexity: categorizeComplexity(hooks.totalHooks, CONFIG.thresholds.hooks)
      },
      conditionals: {
        count: conditionalComplexity,
        ternary: conditionals.ternaryCount,
        logical: conditionals.logicalExpressions,
        complexity: categorizeComplexity(conditionalComplexity, CONFIG.thresholds.conditionals)
      },
      returns: {
        count: returnComplexity,
        complexity: categorizeComplexity(returnComplexity, CONFIG.thresholds.returnFields)
      }
    },
    overallComplexity: calculateOverallComplexity({
      propComplexity,
      hookComplexity, 
      conditionalComplexity,
      returnComplexity
    })
  };
}

/**
 * Categorize complexity level
 */
function categorizeComplexity(value, thresholds) {
  if (value <= thresholds.simple) return 'simple';
  if (value <= thresholds.moderate) return 'moderate';
  if (value <= thresholds.complex) return 'complex';
  return 'excessive';
}

/**
 * Calculate overall complexity score
 */
function calculateOverallComplexity({ propComplexity, hookComplexity, conditionalComplexity, returnComplexity }) {
  // Weighted scoring
  const score = (propComplexity * 2) + 
                (hookComplexity * 1.5) + 
                (conditionalComplexity * 3) + 
                (returnComplexity * 1);
  
  if (score <= 15) return 'simple';
  if (score <= 30) return 'moderate';
  if (score <= 50) return 'complex';
  return 'excessive';
}

/**
 * Find all TypeScript/React files
 */
async function findFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(CONFIG.rootDir, fullPath);
    
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage', '__tests__'].some(exclude => 
        entry.name === exclude || relativePath.includes(exclude))) {
        await findFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      if ((entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
          !entry.name.includes('.test.') && 
          !entry.name.includes('.spec.') &&
          !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Analyze all files for complexity
 */
async function analyzeComplexity() {
  console.log('🧮 Analyzing component complexity...\n');
  
  const files = await findFiles(CONFIG.rootDir);
  const results = [];
  
  for (const file of files) {
    const analysis = await analyzeFileComplexity(file);
    if (analysis) {
      results.push(analysis);
    }
  }
  
  return results;
}

/**
 * Generate complexity report
 */
function generateComplexityReport(results) {
  console.log('📊 Component Complexity Analysis Results');
  console.log('='.repeat(50));
  
  const components = results.filter(r => r.isComponent);
  const hooks = results.filter(r => r.isHook);
  const utils = results.filter(r => !r.isComponent && !r.isHook);
  
  console.log(`Total files analyzed: ${results.length}`);
  console.log(`Components: ${components.length}`);
  console.log(`Hooks: ${hooks.length}`);
  console.log(`Utilities: ${utils.length}`);
  console.log('');
  
  // Complexity distribution
  const complexityDistribution = {
    simple: results.filter(r => r.overallComplexity === 'simple').length,
    moderate: results.filter(r => r.overallComplexity === 'moderate').length,
    complex: results.filter(r => r.overallComplexity === 'complex').length,
    excessive: results.filter(r => r.overallComplexity === 'excessive').length
  };
  
  console.log('📈 Complexity Distribution:');
  console.log('-'.repeat(30));
  Object.entries(complexityDistribution).forEach(([level, count]) => {
    const percentage = ((count / results.length) * 100).toFixed(1);
    console.log(`${level}: ${count} files (${percentage}%)`);
  });
  console.log('');
  
  // Most complex files
  const mostComplex = results
    .filter(r => r.overallComplexity === 'excessive' || r.overallComplexity === 'complex')
    .sort((a, b) => {
      const scoreA = calculateComplexityScore(a.metrics);
      const scoreB = calculateComplexityScore(b.metrics);
      return scoreB - scoreA;
    })
    .slice(0, 10);
  
  if (mostComplex.length > 0) {
    console.log('🚨 Most Complex Files (Top 10):');
    console.log('-'.repeat(35));
    mostComplex.forEach(file => {
      const type = file.isComponent ? '(Component)' : file.isHook ? '(Hook)' : '(Utility)';
      console.log(`${file.path} ${type}`);
      console.log(`  Overall: ${file.overallComplexity}`);
      console.log(`  Props: ${file.metrics.props.count} (${file.metrics.props.complexity})`);
      console.log(`  Hooks: ${file.metrics.hooks.total} (${file.metrics.hooks.complexity})`);
      console.log(`  Conditionals: ${file.metrics.conditionals.count} (${file.metrics.conditionals.complexity})`);
      console.log('');
    });
  }
  
  // Hook-specific analysis
  if (hooks.length > 0) {
    console.log('🪝 Hook Complexity Analysis:');
    console.log('-'.repeat(30));
    
    const avgHooksPerHook = hooks.reduce((sum, h) => sum + h.metrics.hooks.total, 0) / hooks.length;
    const avgReturns = hooks.reduce((sum, h) => sum + h.metrics.returns.count, 0) / hooks.length;
    
    console.log(`Average hooks per custom hook: ${avgHooksPerHook.toFixed(1)}`);
    console.log(`Average return fields: ${avgReturns.toFixed(1)}`);
    
    const complexHooks = hooks.filter(h => 
      h.metrics.returns.count > CONFIG.thresholds.returnFields.moderate ||
      h.metrics.hooks.total > CONFIG.thresholds.hooks.moderate
    );
    
    if (complexHooks.length > 0) {
      console.log(`\n⚠️  Complex hooks (${complexHooks.length}):`);
      complexHooks.slice(0, 5).forEach(hook => {
        console.log(`  ${hook.path} - ${hook.metrics.returns.count} returns, ${hook.metrics.hooks.total} hooks`);
      });
    }
  }
  
  // Calculate health score
  const excessiveCount = complexityDistribution.excessive;
  const complexCount = complexityDistribution.complex;
  
  let healthScore = 100;
  healthScore -= excessiveCount * 15; // Heavy penalty for excessive complexity
  healthScore -= complexCount * 5;    // Moderate penalty for complex files
  
  healthScore = Math.max(0, healthScore);
  
  console.log('\n🏥 Complexity Health Score:');
  console.log('-'.repeat(30));
  console.log(`Score: ${healthScore}/100`);
  
  if (healthScore >= 90) {
    console.log('✅ Excellent complexity management');
  } else if (healthScore >= 80) {
    console.log('🟡 Good complexity management with some areas for improvement');
  } else if (healthScore >= 70) {
    console.log('🟠 Fair complexity management - consider refactoring complex files');
  } else {
    console.log('🔴 Poor complexity management - immediate refactoring needed');
  }
  
  return { healthScore, complexityDistribution, mostComplex, results };
}

/**
 * Calculate numerical complexity score for sorting
 */
function calculateComplexityScore(metrics) {
  return (metrics.props.count * 2) + 
         (metrics.hooks.total * 1.5) + 
         (metrics.conditionals.count * 3) + 
         (metrics.returns.count * 1);
}

/**
 * Save complexity results
 */
async function saveComplexityResults(data) {
  const outputDir = path.join(CONFIG.rootDir, 'reports');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'complexity-analysis.json');
  await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${path.relative(CONFIG.rootDir, outputFile)}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await analyzeComplexity();
    const report = generateComplexityReport(results);
    
    await saveComplexityResults({
      ...report,
      timestamp: new Date().toISOString(),
      config: CONFIG
    });
    
  } catch (error) {
    console.error('❌ Error during complexity analysis:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeComplexity, generateComplexityReport };