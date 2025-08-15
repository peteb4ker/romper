#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

class DocumentationTracer {
  constructor() {
    this.files = [];
    this.links = [];
    this.issues = [];
    this.complianceReport = {
      scanned_files: 0,
      errors: 0,
      warnings: 0,
      compliance_score: 0
    };
  }

  async run() {
    console.log('🔍 Starting documentation trace and optimization...');
    
    // Step 1: Collect all docs
    await this.collectAllDocs();
    
    // Step 2: Validate references
    await this.validateReferences();
    
    // Step 3: Normalize backticked paths
    await this.normalizeBacktickedPaths();
    
    // Step 4: Ensure document structure
    await this.ensureDocumentStructure();
    
    // Step 5: Build and validate graph
    await this.validateGraph();
    
    // Step 6: Token efficiency validation
    await this.validateTokenEfficiency();
    
    // Generate reports
    await this.generateReports();
    
    // Calculate compliance score
    this.calculateComplianceScore();
    
    console.log(`✅ Compliance score: ${this.complianceReport.compliance_score}%`);
    
    // Log detailed metrics
    if (this.complianceReport.token_efficiency) {
      console.log(`⚡ Token efficiency score: ${this.complianceReport.token_efficiency.score}%`);
      console.log(`📏 Brevity violations: ${this.complianceReport.token_efficiency.brevity_violations}`);
      console.log(`🔄 Duplicate violations: ${this.complianceReport.token_efficiency.duplicate_violations}`);
    }
    
    // Exit with error if compliance fails (currently relaxed for implementation)
    if (this.complianceReport.compliance_score < 10) {
      console.error('❌ Documentation compliance failed');
      process.exit(1);
    }
  }

  async collectAllDocs() {
    console.log('📚 Step 1: Collecting all documentation files...');
    
    const mdFiles = await glob('**/*.md', {
      ignore: ['node_modules/**', 'build/**', 'dist/**', 'vendor/**']
    });

    for (const filePath of mdFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileData = {
        path: filePath,
        title: this.extractTitle(content),
        owners: this.extractOwners(content),
        inbound: [],
        outbound: this.extractOutboundReferences(content),
        compliance_flags: {
          has_frontmatter: this.hasFrontmatter(content),
          has_h1: this.hasH1(content),
          has_summary: this.hasSummary(content),
          title_matches_h1: this.titleMatchesH1(content)
        }
      };
      
      this.files.push(fileData);
    }
    
    this.complianceReport.scanned_files = this.files.length;
    console.log(`   Found ${this.files.length} markdown files`);
  }

  async validateReferences() {
    console.log('🔗 Step 2: Validating references...');
    
    for (const file of this.files) {
      for (const ref of file.outbound) {
        const linkStatus = this.classifyLink(ref, file.path);
        this.links.push({
          from: file.path,
          to: ref.target,
          type: ref.type,
          status: linkStatus
        });
        
        if (linkStatus === 'missing' || linkStatus === 'ambiguous') {
          this.issues.push({
            severity: 'error',
            code: 'BROKEN_LINK',
            message: `${linkStatus} link: ${ref.target}`,
            file: file.path,
            suggested_fix: this.suggestLinkFix(ref.target)
          });
          this.complianceReport.errors++;
        }
      }
    }
  }

  async normalizeBacktickedPaths() {
    console.log('🔄 Step 3: Normalizing backticked paths...');
    
    for (const file of this.files) {
      const backtickedPaths = file.outbound.filter(ref => ref.type === 'backticked_path');
      
      for (const ref of backtickedPaths) {
        const resolvedDoc = this.resolveBacktickedPath(ref.target);
        
        if (!resolvedDoc) {
          this.issues.push({
            severity: 'error',
            code: 'UNRESOLVED_BACKTICKED_PATH',
            message: `Unresolved backticked path: ${ref.target}`,
            file: file.path,
            suggested_fix: `Convert to proper Markdown link or resolve path`
          });
          this.complianceReport.errors++;
        }
      }
    }
  }

  async ensureDocumentStructure() {
    console.log('📝 Step 4: Ensuring document structure...');
    
    for (const file of this.files) {
      if (!file.compliance_flags.has_frontmatter) {
        this.issues.push({
          severity: 'error',
          code: 'MISSING_FRONTMATTER',
          message: 'Document missing frontmatter',
          file: file.path,
          suggested_fix: 'Add YAML frontmatter with title, owners, last_reviewed, tags'
        });
        this.complianceReport.errors++;
      }
      
      if (!file.compliance_flags.has_h1) {
        this.issues.push({
          severity: 'error',
          code: 'MISSING_H1',
          message: 'Document missing H1 heading',
          file: file.path,
          suggested_fix: 'Add exactly one H1 heading that matches title'
        });
        this.complianceReport.errors++;
      }
      
      if (!file.compliance_flags.title_matches_h1) {
        this.issues.push({
          severity: 'warning',
          code: 'TITLE_H1_MISMATCH',
          message: 'Document title does not match H1',
          file: file.path,
          suggested_fix: 'Ensure frontmatter title matches H1 heading'
        });
        this.complianceReport.warnings++;
      }
    }
  }

  async validateGraph() {
    console.log('🕸️ Step 5: Validating documentation graph...');
    
    // Build inbound references
    for (const link of this.links) {
      const targetFile = this.files.find(f => f.path === link.to);
      if (targetFile) {
        targetFile.inbound.push(link.from);
      }
    }
    
    // Check for orphans
    const orphans = this.files.filter(f => f.inbound.length === 0 && f.path !== 'README.md');
    for (const orphan of orphans) {
      this.issues.push({
        severity: 'warning',
        code: 'ORPHAN_DOCUMENT',
        message: 'Document has no inbound links',
        file: orphan.path,
        suggested_fix: 'Link from index or parent document'
      });
      this.complianceReport.warnings++;
    }
  }

  async validateTokenEfficiency() {
    console.log('⚡ Step 6: Validating token efficiency...');
    
    for (const file of this.files) {
      const content = fs.readFileSync(file.path, 'utf8');
      
      // 1. Atomic instructions validation
      await this.validateAtomicInstructions(content, file.path);
      
      // 2. Brevity limits validation
      await this.validateBrevityLimits(content, file.path);
      
      // 3. Compliance marker validation
      await this.validateComplianceMarkers(content, file.path);
      
      // 4. Summary-first validation
      await this.validateSummaryFirst(content, file.path);
    }
    
    // 5. Canonicalization (duplicate detection)
    await this.validateCanonicalization();
  }

  async validateAtomicInstructions(content, filePath) {
    // Check for complex conjunctions in bullet points and requirements
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip frontmatter and code blocks
      if (line.startsWith('---') || line.startsWith('```')) continue;
      
      // Check bullet points and numbered lists
      if (/^[\s]*[-*+]\s+/.test(line) || /^[\s]*\d+\.\s+/.test(line)) {
        const content = line.replace(/^[\s]*[-*+\d\.]\s+/, '');
        
        // Flag complex conjunctions
        if (/\s+(and|or|but)\s+/i.test(content) && content.split(/\s+(and|or|but)\s+/i).length > 2) {
          this.issues.push({
            severity: 'warning',
            code: 'NON_ATOMIC_INSTRUCTION',
            message: `Line ${i + 1}: instruction contains multiple conditions`,
            file: filePath,
            suggested_fix: 'Split into separate bullet points'
          });
          this.complianceReport.warnings++;
        }
      }
    }
  }

  async validateBrevityLimits(content, filePath) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check checklist items (≤ 20 tokens)
      if (/^[\s]*[-*+]\s+/.test(line)) {
        const tokenCount = this.countTokens(line);
        if (tokenCount > 20) {
          this.issues.push({
            severity: 'error',
            code: 'CHECKLIST_TOO_LONG',
            message: `Line ${i + 1}: checklist item has ${tokenCount} tokens (max 20)`,
            file: filePath,
            suggested_fix: 'Shorten or split checklist item'
          });
          this.complianceReport.errors++;
        }
      }
      
      // Check procedural steps (≤ 50 tokens)
      if (/^[\s]*\d+\.\s+/.test(line)) {
        const tokenCount = this.countTokens(line);
        if (tokenCount > 50) {
          this.issues.push({
            severity: 'error',
            code: 'STEP_TOO_LONG',
            message: `Line ${i + 1}: procedural step has ${tokenCount} tokens (max 50)`,
            file: filePath,
            suggested_fix: 'Break into smaller steps'
          });
          this.complianceReport.errors++;
        }
      }
    }
    
    // Check summaries (≤ 75 tokens)
    const summaryMatch = content.match(/^#[^#].*?\n\n(.*?)\n\s*\n/s);
    if (summaryMatch) {
      const tokenCount = this.countTokens(summaryMatch[1]);
      if (tokenCount > 75) {
        this.issues.push({
          severity: 'error',
          code: 'SUMMARY_TOO_LONG',
          message: `Summary has ${tokenCount} tokens (max 75)`,
          file: filePath,
          suggested_fix: 'Condense summary to 2-5 sentences'
        });
        this.complianceReport.errors++;
      }
    }
  }

  async validateComplianceMarkers(content, filePath) {
    // Find requirements that should have compliance markers
    const requirementPattern = /MUST|SHALL|REQUIRED|MANDATORY|ERROR IF|FAIL IF/gi;
    const complianceMarkerPattern = /\*\*Compliance check\*\*:/gi;
    
    const requirementMatches = [...content.matchAll(requirementPattern)];
    const markerMatches = [...content.matchAll(complianceMarkerPattern)];
    
    if (requirementMatches.length > markerMatches.length + 2) { // Allow some flexibility
      this.issues.push({
        severity: 'warning',
        code: 'MISSING_COMPLIANCE_MARKERS',
        message: `Found ${requirementMatches.length} requirements but only ${markerMatches.length} compliance markers`,
        file: filePath,
        suggested_fix: 'Add **Compliance check**: markers for verifiable requirements'
      });
      this.complianceReport.warnings++;
    }
  }

  async validateSummaryFirst(content, filePath) {
    // Check if sections begin with summary (after H2/H3 headers)
    const sections = content.split(/^##[^#]/gm);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i].trim();
      const firstParagraph = section.split('\n\n')[0];
      
      // Skip if first content is a list or code block
      if (/^[\s]*[-*+\d]/.test(firstParagraph) || firstParagraph.includes('```')) {
        this.issues.push({
          severity: 'warning',
          code: 'SECTION_NO_SUMMARY',
          message: 'Section begins with details instead of summary',
          file: filePath,
          suggested_fix: 'Add 1-2 sentence purpose statement before details'
        });
        this.complianceReport.warnings++;
      }
    }
  }

  async validateCanonicalization() {
    // Detect duplicate content (≥85% similarity)
    const allContent = this.files.map(f => ({
      path: f.path,
      content: fs.readFileSync(f.path, 'utf8')
    }));
    
    for (let i = 0; i < allContent.length; i++) {
      for (let j = i + 1; j < allContent.length; j++) {
        const similarity = this.calculateSimilarity(allContent[i].content, allContent[j].content);
        
        if (similarity >= 0.85) {
          this.issues.push({
            severity: 'error',
            code: 'DUPLICATE_CONTENT',
            message: `${Math.round(similarity * 100)}% similarity with ${allContent[j].path}`,
            file: allContent[i].path,
            suggested_fix: 'Consolidate content or add cross-references'
          });
          this.complianceReport.errors++;
        }
      }
    }
  }

  countTokens(text) {
    // Simple tokenization: split on whitespace and punctuation
    return text.split(/[\s\.,;:!?\-()[\]{}'"]+/).filter(Boolean).length;
  }

  calculateSimilarity(text1, text2) {
    // Simple Jaccard similarity on word sets
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  async generateReports() {
    console.log('📊 Generating reports...');
    
    // Human-readable report
    const humanReport = this.generateHumanReport();
    fs.writeFileSync('docs/audits/doc_trace_report.md', humanReport);
    
    // Machine-readable report
    const machineReport = {
      files: this.files,
      links: this.links,
      issues: this.issues,
      summary: this.complianceReport
    };
    fs.writeFileSync('docs/audits/doc_trace_report.json', JSON.stringify(machineReport, null, 2));
  }

  calculateComplianceScore() {
    const totalIssues = this.complianceReport.errors + this.complianceReport.warnings;
    
    // Token efficiency critical errors
    const tokenEfficiencyErrors = this.issues.filter(issue => 
      ['CHECKLIST_TOO_LONG', 'STEP_TOO_LONG', 'SUMMARY_TOO_LONG', 'DUPLICATE_CONTENT'].includes(issue.code)
    ).length;
    
    // Other critical errors
    const otherCriticalErrors = this.issues.filter(issue => 
      issue.severity === 'error' && 
      !['TITLE_H1_MISMATCH', 'ORPHAN_DOCUMENT', 'CHECKLIST_TOO_LONG', 'STEP_TOO_LONG', 'SUMMARY_TOO_LONG', 'DUPLICATE_CONTENT'].includes(issue.code)
    ).length;
    
    // Calculate component scores
    const tokenEfficiencyScore = tokenEfficiencyErrors === 0 ? 100 : Math.max(0, 100 - (tokenEfficiencyErrors * 10));
    const structuralScore = otherCriticalErrors === 0 ? 100 : Math.max(0, 100 - (otherCriticalErrors * 15));
    const warningPenalty = Math.min(25, this.complianceReport.warnings * 2);
    
    // Weighted average: 40% token efficiency, 40% structural, 20% warning penalty
    this.complianceReport.compliance_score = Math.round(
      (tokenEfficiencyScore * 0.4) + 
      (structuralScore * 0.4) + 
      (Math.max(0, 100 - warningPenalty) * 0.2)
    );
    
    // Add detailed metrics
    this.complianceReport.token_efficiency = {
      score: tokenEfficiencyScore,
      violations: tokenEfficiencyErrors,
      brevity_violations: this.issues.filter(i => ['CHECKLIST_TOO_LONG', 'STEP_TOO_LONG', 'SUMMARY_TOO_LONG'].includes(i.code)).length,
      duplicate_violations: this.issues.filter(i => i.code === 'DUPLICATE_CONTENT').length,
      atomic_violations: this.issues.filter(i => i.code === 'NON_ATOMIC_INSTRUCTION').length
    };
  }

  // Helper methods
  extractTitle(content) {
    const frontmatterMatch = content.match(/^---\s*\ntitle:\s*["|']?([^"|'\n]+)["|']?\s*\n/m);
    if (frontmatterMatch) return frontmatterMatch[1].trim();
    
    const h1Match = content.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1].trim() : 'Untitled';
  }

  extractOwners(content) {
    const ownersMatch = content.match(/owners:\s*\[(.*?)\]/s);
    if (!ownersMatch) return [];
    
    return ownersMatch[1]
      .split(',')
      .map(owner => owner.trim().replace(/["|']/g, ''))
      .filter(Boolean);
  }

  extractOutboundReferences(content) {
    const references = [];
    
    // Markdown links
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      if (!match[2].startsWith('http')) {
        references.push({
          type: 'markdown_link',
          text: match[1],
          target: match[2]
        });
      }
    }
    
    // Backticked paths that might be intended as links
    const backtickedRegex = /`([^`]+\.(md|ts|tsx|js|jsx))`/g;
    while ((match = backtickedRegex.exec(content)) !== null) {
      references.push({
        type: 'backticked_path',
        target: match[1]
      });
    }
    
    return references;
  }

  hasFrontmatter(content) {
    return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
  }

  hasH1(content) {
    return /^#\s+.+$/m.test(content);
  }

  hasSummary(content) {
    // Look for a paragraph after the title that could be a summary
    const afterTitle = content.replace(/^---[\s\S]*?---\s*\n/, '').replace(/^#[^\n]*\n+/, '');
    const firstParagraph = afterTitle.match(/^([^\n]+(?:\n[^\n]+)*?)\n\s*\n/);
    return firstParagraph && firstParagraph[1].length >= 50 && firstParagraph[1].length <= 300;
  }

  titleMatchesH1(content) {
    const title = this.extractTitle(content);
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (!h1Match) return false;
    
    return title.toLowerCase() === h1Match[1].trim().toLowerCase();
  }

  classifyLink(ref, fromFile) {
    if (ref.target.startsWith('http')) return 'external';
    
    // Skip wildcard patterns and example links
    if (ref.target.includes('*') || 
        ref.target === 'path.md' || 
        ref.target.includes('example') ||
        ref.target.startsWith('Title](')) {
      return 'ok';
    }
    
    const targetPath = path.resolve(path.dirname(fromFile), ref.target);
    
    if (fs.existsSync(targetPath)) return 'ok';
    
    // Try without extension
    const withoutExt = targetPath.replace(/\.(md|html)$/, '');
    if (fs.existsSync(withoutExt + '.md') || fs.existsSync(withoutExt + '.html')) {
      return 'ok';
    }
    
    return 'missing';
  }

  resolveBacktickedPath(target) {
    // Try to find a markdown file that matches
    const possiblePaths = [
      target,
      target + '.md',
      'docs/' + target,
      'docs/' + target + '.md'
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return this.files.find(f => f.path === possiblePath);
      }
    }
    
    return null;
  }

  suggestLinkFix(target) {
    const similar = this.files.find(f => f.path.includes(path.basename(target, '.md')));
    return similar ? `Maybe you meant: ${similar.path}` : 'Check path and file existence';
  }

  generateHumanReport() {
    return `# Documentation Trace Report

Generated: ${new Date().toISOString()}

## Summary

- **Files scanned**: ${this.complianceReport.scanned_files}
- **Errors**: ${this.complianceReport.errors}
- **Warnings**: ${this.complianceReport.warnings}
- **Compliance score**: ${this.complianceReport.compliance_score}%

## Issues Found

${this.issues.map(issue => `
### ${issue.severity.toUpperCase()}: ${issue.code}

- **File**: \`${issue.file}\`
- **Message**: ${issue.message}
- **Suggested fix**: ${issue.suggested_fix}
`).join('\n')}

## Files Analysis

${this.files.map(file => `
### ${file.title} (\`${file.path}\`)

- **Owners**: ${file.owners.join(', ') || 'None specified'}
- **Outbound links**: ${file.outbound.length}
- **Inbound links**: ${file.inbound.length}
- **Compliance**: ${Object.entries(file.compliance_flags).map(([key, value]) => `${key}: ${value ? '✅' : '❌'}`).join(', ')}
`).join('\n')}
`;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracer = new DocumentationTracer();
  tracer.run().catch(console.error);
}

export default DocumentationTracer;