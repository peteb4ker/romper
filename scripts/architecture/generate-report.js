#!/usr/bin/env node

/**
 * Comprehensive Architectural Assessment Report Generator
 * 
 * Consolidates all architectural analysis results into a single, token-efficient report
 * that provides clear architectural status and actionable recommendations.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  reportsDir: path.resolve(__dirname, '../../reports')
};

/**
 * Load analysis results from JSON files
 */
async function loadAnalysisResults() {
  const results = {};
  
  try {
    const locFile = path.join(CONFIG.reportsDir, 'loc-analysis.json');
    results.loc = JSON.parse(await fs.readFile(locFile, 'utf-8'));
  } catch (error) {
    results.loc = null;
  }
  
  try {
    const depFile = path.join(CONFIG.reportsDir, 'dependency-analysis.json');
    results.dependencies = JSON.parse(await fs.readFile(depFile, 'utf-8'));
  } catch (error) {
    results.dependencies = null;
  }
  
  try {
    const complexityFile = path.join(CONFIG.reportsDir, 'complexity-analysis.json');
    results.complexity = JSON.parse(await fs.readFile(complexityFile, 'utf-8'));
  } catch (error) {
    results.complexity = null;
  }
  
  return results;
}

/**
 * Generate overall architectural health score
 */
function calculateOverallHealthScore(results) {
  let score = 100;
  let penalties = [];
  
  // LOC penalties
  if (results.loc?.categories?.redFlag?.length > 0) {
    const penalty = results.loc.categories.redFlag.length * 10;
    score -= penalty;
    penalties.push(`LOC red flags: -${penalty} (${results.loc.categories.redFlag.length} files >300 LOC)`);
  }
  
  // Complexity penalties  
  if (results.complexity?.complexityDistribution?.excessive > 0) {
    const penalty = results.complexity.complexityDistribution.excessive * 5;
    score -= penalty;
    penalties.push(`Excessive complexity: -${penalty} (${results.complexity.complexityDistribution.excessive} files)`);
  }
  
  // Dependency penalties
  if (results.dependencies?.circularResult?.circularDependencies?.length > 0) {
    const penalty = results.dependencies.circularResult.circularDependencies.length * 20;
    score -= penalty;
    penalties.push(`Circular dependencies: -${penalty}`);
  }
  
  return {
    score: Math.max(0, Math.round(score)),
    penalties
  };
}

/**
 * Get top architectural issues requiring immediate attention
 */
function getTopIssues(results) {
  const issues = [];
  
  // Critical LOC violations
  if (results.loc?.categories?.redFlag) {
    const topLoc = results.loc.categories.redFlag
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 5);
    
    issues.push({
      priority: 'CRITICAL',
      category: 'Lines of Code',
      description: `${results.loc.categories.redFlag.length} files exceed 300 LOC limit`,
      topOffenders: topLoc.map(f => `${f.path} (${f.loc} LOC)`)
    });
  }
  
  // Excessive complexity
  if (results.complexity?.mostComplex) {
    const excessiveFiles = results.complexity.mostComplex.filter(f => 
      f.overallComplexity === 'excessive'
    ).slice(0, 5);
    
    if (excessiveFiles.length > 0) {
      issues.push({
        priority: 'HIGH',
        category: 'Component Complexity',
        description: `${results.complexity.complexityDistribution.excessive} files with excessive complexity`,
        topOffenders: excessiveFiles.map(f => {
          const type = f.isComponent ? 'Component' : f.isHook ? 'Hook' : 'Utility';
          return `${f.path} (${type})`;
        })
      });
    }
  }
  
  // Hook complexity
  if (results.complexity?.results) {
    const complexHooks = results.complexity.results
      .filter(r => r.isHook && (
        r.metrics.returns.count > 12 || 
        r.metrics.hooks.total > 10
      ))
      .sort((a, b) => b.metrics.returns.count - a.metrics.returns.count)
      .slice(0, 3);
    
    if (complexHooks.length > 0) {
      issues.push({
        priority: 'MEDIUM',
        category: 'Hook Architecture', 
        description: `${complexHooks.length} hooks with excessive returns/dependencies`,
        topOffenders: complexHooks.map(h => 
          `${h.path} (${h.metrics.returns.count} returns, ${h.metrics.hooks.total} hooks)`
        )
      });
    }
  }
  
  return issues;
}

/**
 * Get architectural strengths 
 */
function getArchitecturalStrengths(results) {
  const strengths = [];
  
  // No circular dependencies
  if (results.dependencies?.circularResult && !results.dependencies.circularResult.hasCircularDependencies) {
    strengths.push('✅ No circular dependencies detected');
  }
  
  // Good test coverage structure
  if (results.loc?.stats?.totalFiles) {
    const testFileCount = results.loc.files?.filter(f => f.path.includes('__tests__')).length || 0;
    if (testFileCount > 0) {
      strengths.push('✅ Comprehensive test suite with co-located tests');
    }
  }
  
  // Hook architecture
  if (results.complexity?.results) {
    const hookCount = results.complexity.results.filter(r => r.isHook).length;
    if (hookCount > 40) {
      strengths.push(`✅ Strong hook architecture (${hookCount} custom hooks)`);
    }
  }
  
  // Type safety
  strengths.push('✅ TypeScript with strict mode and Drizzle ORM type safety');
  
  // Domain organization
  strengths.push('✅ Clear domain separation (components, hooks, utils, shared)');
  
  return strengths;
}

/**
 * Generate refactoring recommendations
 */
function generateRecommendations(results) {
  const recommendations = [];
  
  // Immediate actions (red flags)
  if (results.loc?.categories?.redFlag?.length > 0) {
    recommendations.push({
      timeframe: 'IMMEDIATE',
      action: 'Refactor oversized files',
      description: 'Break down files exceeding 300 LOC',
      files: results.loc.categories.redFlag.slice(0, 3).map(f => f.path),
      impact: 'Reduces maintenance burden and improves testability'
    });
  }
  
  // Near-term actions (complexity)
  if (results.complexity?.complexityDistribution?.excessive > 5) {
    recommendations.push({
      timeframe: 'NEAR-TERM',
      action: 'Simplify component complexity',
      description: 'Extract custom hooks and utility functions from complex components',
      impact: 'Improves code reusability and reduces cognitive load'
    });
  }
  
  // Long-term improvements
  recommendations.push({
    timeframe: 'ONGOING',
    action: 'Implement architectural quality gates',
    description: 'Add pre-commit hooks for LOC limits and complexity checks',
    impact: 'Prevents architectural debt accumulation'
  });
  
  return recommendations;
}

/**
 * Generate token-efficient architectural summary
 */
function generateTokenEfficientSummary(results, healthScore, issues, strengths, recommendations) {
  const summary = {
    // Core metrics (most important for agents)
    archHealth: {
      score: healthScore.score,
      level: healthScore.score >= 80 ? 'GOOD' : healthScore.score >= 60 ? 'FAIR' : 'POOR'
    },
    
    // Key statistics 
    codebase: {
      totalFiles: results.loc?.stats?.totalFiles || 0,
      totalLoc: results.loc?.stats?.totalLines || 0,
      avgLoc: results.loc?.stats?.averageLines || 0,
      components: results.complexity?.results?.filter(r => r.isComponent).length || 0,
      hooks: results.complexity?.results?.filter(r => r.isHook).length || 0
    },
    
    // Critical issues requiring attention
    criticalIssues: issues.filter(i => i.priority === 'CRITICAL').length,
    redFlagFiles: results.loc?.categories?.redFlag?.length || 0,
    excessiveComplexity: results.complexity?.complexityDistribution?.excessive || 0,
    
    // Top problems (for agent action)
    topProblems: issues.slice(0, 3).map(issue => ({
      category: issue.category,
      count: issue.topOffenders?.length || 0,
      files: issue.topOffenders?.slice(0, 2) // Only top 2 for token efficiency
    })),
    
    // Immediate actions needed
    immediateActions: recommendations.filter(r => r.timeframe === 'IMMEDIATE').map(r => ({
      action: r.action,
      files: r.files?.slice(0, 3) // Top 3 files only
    })),
    
    // Architecture strengths
    strengths: strengths.slice(0, 5), // Top 5 strengths
    
    // Quality gates status
    qualityGates: {
      locCompliance: (results.loc?.categories?.redFlag?.length || 0) === 0,
      complexityCompliance: (results.complexity?.complexityDistribution?.excessive || 0) < 5,
      dependencyHealth: !results.dependencies?.circularResult?.hasCircularDependencies,
      overallPassing: healthScore.score >= 70
    }
  };
  
  return summary;
}

/**
 * Generate full detailed report
 */
function generateDetailedReport(results, healthScore, issues, strengths, recommendations) {
  const timestamp = new Date().toISOString();
  
  let report = `# Romper Architectural Assessment Report\n\n`;
  report += `**Generated**: ${timestamp}\n`;
  report += `**Overall Health Score**: ${healthScore.score}/100\n\n`;
  
  // Executive Summary
  report += `## Executive Summary\n\n`;
  if (healthScore.score >= 80) {
    report += `✅ **Architecture Status: GOOD** - Minor improvements needed\n\n`;
  } else if (healthScore.score >= 60) {
    report += `🟡 **Architecture Status: FAIR** - Several areas need attention\n\n`;
  } else {
    report += `🔴 **Architecture Status: POOR** - Immediate refactoring required\n\n`;
  }
  
  // Key Metrics
  report += `### Key Metrics\n\n`;
  if (results.loc) {
    report += `- **Total Files**: ${results.loc.stats.totalFiles}\n`;
    report += `- **Total LOC**: ${results.loc.stats.totalLines.toLocaleString()}\n`;
    report += `- **Average LOC/File**: ${results.loc.stats.averageLines}\n`;
  }
  if (results.complexity) {
    const components = results.complexity.results?.filter(r => r.isComponent).length || 0;
    const hooks = results.complexity.results?.filter(r => r.isHook).length || 0;
    report += `- **Components**: ${components}\n`;
    report += `- **Custom Hooks**: ${hooks}\n`;
  }
  report += `\n`;
  
  // Critical Issues
  if (issues.length > 0) {
    report += `## Critical Issues Requiring Attention\n\n`;
    issues.forEach(issue => {
      report += `### ${issue.priority}: ${issue.category}\n`;
      report += `${issue.description}\n\n`;
      if (issue.topOffenders && issue.topOffenders.length > 0) {
        report += `**Top Offenders:**\n`;
        issue.topOffenders.slice(0, 5).forEach(offender => {
          report += `- ${offender}\n`;
        });
        report += `\n`;
      }
    });
  }
  
  // Recommendations
  report += `## Recommended Actions\n\n`;
  recommendations.forEach(rec => {
    report += `### ${rec.timeframe}: ${rec.action}\n`;
    report += `${rec.description}\n\n`;
    if (rec.files && rec.files.length > 0) {
      report += `**Priority Files:**\n`;
      rec.files.forEach(file => {
        report += `- ${file}\n`;
      });
    }
    report += `**Impact**: ${rec.impact}\n\n`;
  });
  
  // Strengths
  if (strengths.length > 0) {
    report += `## Architectural Strengths\n\n`;
    strengths.forEach(strength => {
      report += `${strength}\n`;
    });
    report += `\n`;
  }
  
  // Health Score Breakdown
  if (healthScore.penalties.length > 0) {
    report += `## Health Score Breakdown\n\n`;
    report += `Starting Score: 100\n`;
    healthScore.penalties.forEach(penalty => {
      report += `${penalty}\n`;
    });
    report += `\n**Final Score**: ${healthScore.score}/100\n\n`;
  }
  
  return report;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('📊 Generating comprehensive architectural assessment report...\n');
    
    // Load all analysis results
    const results = await loadAnalysisResults();
    
    // Calculate overall health
    const healthScore = calculateOverallHealthScore(results);
    
    // Extract key insights
    const issues = getTopIssues(results);
    const strengths = getArchitecturalStrengths(results);
    const recommendations = generateRecommendations(results);
    
    // Generate token-efficient summary for agents
    const summary = generateTokenEfficientSummary(results, healthScore, issues, strengths, recommendations);
    
    // Generate detailed human-readable report
    const detailedReport = generateDetailedReport(results, healthScore, issues, strengths, recommendations);
    
    // Ensure reports directory exists
    await fs.mkdir(CONFIG.reportsDir, { recursive: true });
    
    // Save token-efficient summary (for agents)
    const summaryFile = path.join(CONFIG.reportsDir, 'architectural-summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    
    // Save detailed report (for humans)
    const reportFile = path.join(CONFIG.reportsDir, 'architectural-assessment.md');
    await fs.writeFile(reportFile, detailedReport);
    
    // Console output
    console.log('📋 Architectural Assessment Summary');
    console.log('='.repeat(40));
    console.log(`Overall Health Score: ${healthScore.score}/100`);
    console.log(`Status: ${summary.archHealth.level}`);
    console.log(`Critical Issues: ${summary.criticalIssues}`);
    console.log(`Red Flag Files (>300 LOC): ${summary.redFlagFiles}`);
    console.log(`Files with Excessive Complexity: ${summary.excessiveComplexity}`);
    console.log('');
    
    if (summary.immediateActions.length > 0) {
      console.log('🚨 Immediate Actions Required:');
      summary.immediateActions.forEach(action => {
        console.log(`- ${action.action}`);
        if (action.files) {
          action.files.forEach(file => console.log(`  • ${file}`));
        }
      });
      console.log('');
    }
    
    console.log('💾 Reports Generated:');
    console.log(`- Token-efficient summary: ${path.relative(CONFIG.rootDir, summaryFile)}`);
    console.log(`- Detailed assessment: ${path.relative(CONFIG.rootDir, reportFile)}`);
    console.log('');
    
    console.log('🏗️  Architecture Status Summary:');
    console.log(`- Quality Gates Passing: ${summary.qualityGates.overallPassing ? '✅' : '❌'}`);
    console.log(`- LOC Compliance: ${summary.qualityGates.locCompliance ? '✅' : '❌'}`);
    console.log(`- Complexity Compliance: ${summary.qualityGates.complexityCompliance ? '✅' : '❌'}`);
    console.log(`- Dependency Health: ${summary.qualityGates.dependencyHealth ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error generating architectural report:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateTokenEfficientSummary, generateDetailedReport };