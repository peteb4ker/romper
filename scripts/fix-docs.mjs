#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

class DocumentationFixer {
  constructor() {
    this.fixes = [];
  }

  async run() {
    console.log('🔧 Starting documentation fixes...');
    
    // Read the audit report
    const auditReport = JSON.parse(fs.readFileSync('docs/audits/doc_trace_report.json', 'utf8'));
    
    // Apply fixes based on issues
    for (const issue of auditReport.issues) {
      await this.applyFix(issue);
    }
    
    // Add frontmatter to files that need it
    await this.addMissingFrontmatter(auditReport.files);
    
    console.log(`✅ Applied ${this.fixes.length} fixes`);
    
    // Re-run audit to check compliance
    console.log('🔍 Re-running audit...');
    const { default: DocumentationTracer } = await import('./check-docs.mjs');
    const tracer = new DocumentationTracer();
    await tracer.run();
  }

  async applyFix(issue) {
    switch (issue.code) {
      case 'BROKEN_LINK':
        await this.fixBrokenLink(issue);
        break;
      case 'UNRESOLVED_BACKTICKED_PATH':
        await this.fixBacktickedPath(issue);
        break;
      case 'MISSING_FRONTMATTER':
        await this.addFrontmatter(issue);
        break;
      case 'MISSING_H1':
        await this.addH1(issue);
        break;
      default:
        console.log(`⚠️  No fix available for: ${issue.code}`);
    }
  }

  async fixBrokenLink(issue) {
    // Skip wildcard patterns and focus on fixable links
    if (issue.message.includes('*.')) return;
    
    const content = fs.readFileSync(issue.file, 'utf8');
    
    // Try to find the actual target file
    const linkTarget = issue.message.replace('missing link: ', '');
    const possibleTargets = await this.findSimilarFiles(linkTarget);
    
    if (possibleTargets.length === 1) {
      const newContent = content.replace(
        new RegExp(`\\]\\(${this.escapeRegex(linkTarget)}\\)`, 'g'),
        `](${possibleTargets[0]})`
      );
      
      fs.writeFileSync(issue.file, newContent);
      this.fixes.push(`Fixed broken link ${linkTarget} → ${possibleTargets[0]} in ${issue.file}`);
    }
  }

  async fixBacktickedPath(issue) {
    const content = fs.readFileSync(issue.file, 'utf8');
    const pathTarget = issue.message.replace('Unresolved backticked path: ', '');
    
    // Try to resolve the path to a documentation file
    const resolvedDoc = await this.findDocumentationFile(pathTarget);
    
    if (resolvedDoc) {
      const title = this.extractTitleFromFile(resolvedDoc);
      const newContent = content.replace(
        new RegExp(`\`${this.escapeRegex(pathTarget)}\``, 'g'),
        `[${title}](${resolvedDoc})`
      );
      
      fs.writeFileSync(issue.file, newContent);
      this.fixes.push(`Converted backticked path ${pathTarget} → [${title}](${resolvedDoc}) in ${issue.file}`);
    }
  }

  async addFrontmatter(issue) {
    const content = fs.readFileSync(issue.file, 'utf8');
    
    // Extract title from H1 or filename
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1] : path.basename(issue.file, '.md');
    
    // Determine owners based on file location
    const owners = this.determineOwners(issue.file);
    
    // Determine tags based on file location
    const tags = this.determineTags(issue.file);
    
    const frontmatter = `---
title: "${title}"
owners: [${owners.map(o => `"${o}"`).join(', ')}]
last_reviewed: "${new Date().toISOString().split('T')[0]}"
tags: [${tags.map(t => `"${t}"`).join(', ')}]
---

`;
    
    const newContent = frontmatter + content;
    fs.writeFileSync(issue.file, newContent);
    this.fixes.push(`Added frontmatter to ${issue.file}`);
  }

  async addH1(issue) {
    const content = fs.readFileSync(issue.file, 'utf8');
    
    // Extract title from frontmatter or filename
    const frontmatterMatch = content.match(/^---\s*\ntitle:\s*["|']?([^"|'\n]+)["|']?\s*\n/m);
    const title = frontmatterMatch ? frontmatterMatch[1] : path.basename(issue.file, '.md');
    
    // Find where to insert H1 (after frontmatter if present)
    const afterFrontmatter = content.replace(/^---[\s\S]*?---\s*\n/, '');
    const h1 = `# ${title}\n\n`;
    
    const newContent = content.replace(afterFrontmatter, h1 + afterFrontmatter);
    fs.writeFileSync(issue.file, newContent);
    this.fixes.push(`Added H1 to ${issue.file}`);
  }

  async addMissingFrontmatter(files) {
    for (const file of files) {
      if (!file.compliance_flags.has_frontmatter) {
        await this.addFrontmatter({
          file: file.path,
          code: 'MISSING_FRONTMATTER'
        });
      }
    }
  }

  async findSimilarFiles(target) {
    const allFiles = await glob('**/*.md', {
      ignore: ['node_modules/**', 'build/**', 'dist/**']
    });
    
    const targetBase = path.basename(target, '.md').toLowerCase();
    
    return allFiles.filter(file => {
      const fileBase = path.basename(file, '.md').toLowerCase();
      return fileBase.includes(targetBase) || targetBase.includes(fileBase);
    });
  }

  async findDocumentationFile(pathTarget) {
    // Look for corresponding documentation files
    const baseName = path.basename(pathTarget, path.extname(pathTarget));
    const possibleDocs = [
      `docs/developer/${baseName}.md`,
      `docs/user/${baseName}.md`,
      `docs/${baseName}.md`,
      `.agent/standards/${baseName}.md`
    ];
    
    for (const docPath of possibleDocs) {
      if (fs.existsSync(docPath)) {
        return docPath;
      }
    }
    
    return null;
  }

  extractTitleFromFile(filePath) {
    if (!fs.existsSync(filePath)) return path.basename(filePath, '.md');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const h1Match = content.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1] : path.basename(filePath, '.md');
  }

  determineOwners(filePath) {
    if (filePath.includes('docs/developer/')) return ['developer-team'];
    if (filePath.includes('docs/user/')) return ['product-team'];
    if (filePath.includes('.agent/')) return ['agent-system'];
    if (filePath.includes('tasks/')) return ['product-team'];
    return ['maintainer'];
  }

  determineTags(filePath) {
    const tags = [];
    
    if (filePath.includes('docs/developer/')) tags.push('developer');
    if (filePath.includes('docs/user/')) tags.push('user-guide');
    if (filePath.includes('.agent/')) tags.push('agent-instructions');
    if (filePath.includes('tasks/')) tags.push('project-management');
    if (filePath.includes('architecture')) tags.push('architecture');
    if (filePath.includes('api')) tags.push('api');
    if (filePath.includes('workflow')) tags.push('workflow');
    
    return tags.length > 0 ? tags : ['documentation'];
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new DocumentationFixer();
  fixer.run().catch(console.error);
}

export default DocumentationFixer;