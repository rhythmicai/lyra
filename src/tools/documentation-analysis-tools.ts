
export interface DocMetrics {
  // JSDoc/TSDoc metrics
  totalFunctions: number;
  documentedFunctions: number;
  totalClasses: number;
  documentedClasses: number;
  totalMethods: number;
  documentedMethods: number;
  totalParameters: number;
  documentedParameters: number;
  totalExports: number;
  documentedExports: number;
  
  // Comment metrics
  inlineCommentLines: number;
  blockCommentLines: number;
  todoCount: number;
  fixmeCount: number;
  commentToCodeRatio: number;
  
  // Documentation file metrics
  hasReadme: boolean;
  readmeCompleteness: number; // 0-100 score
  hasContributing: boolean;
  hasApiDocs: boolean;
  markdownFileCount: number;
  
  // Quality scores
  overallDocScore: number; // 0-100
  codeDocScore: number; // 0-100
  projectDocScore: number; // 0-100
}

export interface FileDocAnalysis {
  path: string;
  language: string;
  metrics: Partial<DocMetrics>;
  undocumentedSymbols: string[];
  suggestions: string[];
}

export class DocumentationAnalysisTools {
  
  /**
   * Analyzes TypeScript/JavaScript files for JSDoc/TSDoc documentation
   */
  async analyzeTypeScriptDocs(content: string, filePath: string): Promise<FileDocAnalysis> {
    const metrics: Partial<DocMetrics> = {
      totalFunctions: 0,
      documentedFunctions: 0,
      totalClasses: 0,
      documentedClasses: 0,
      totalMethods: 0,
      documentedMethods: 0,
      totalParameters: 0,
      documentedParameters: 0,
      totalExports: 0,
      documentedExports: 0,
      inlineCommentLines: 0,
      blockCommentLines: 0,
      todoCount: 0,
      fixmeCount: 0
    };
    
    const undocumentedSymbols: string[] = [];
    const suggestions: string[] = [];
    
    // Parse for function declarations and their documentation
    const functionRegex = /(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\):\s*\w+\s*=>|function))/g;
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    // const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|]+)?\s*{/g; // TODO: implement method analysis
    
    // Check for preceding documentation
    const lines = content.split('\n');
    let inBlockComment = false;
    let lastDocBlock: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Count inline comments
      if (trimmedLine.startsWith('//')) {
        metrics.inlineCommentLines!++;
        if (trimmedLine.match(/TODO/i)) metrics.todoCount!++;
        if (trimmedLine.match(/FIXME/i)) metrics.fixmeCount!++;
      }
      
      // Track block comments
      if (trimmedLine.startsWith('/**')) {
        inBlockComment = true;
        lastDocBlock = [trimmedLine];
      } else if (inBlockComment) {
        lastDocBlock.push(trimmedLine);
        if (trimmedLine.endsWith('*/')) {
          inBlockComment = false;
          metrics.blockCommentLines! += lastDocBlock.length;
        }
      }
      
      // Check for functions after doc blocks
      functionRegex.lastIndex = 0; // Reset regex state
      const functionMatch = functionRegex.exec(line); // Use line instead of trimmedLine to preserve spacing
      if (functionMatch) {
        metrics.totalFunctions!++;
        const functionName = functionMatch[1] || functionMatch[2];
        const hasDoc = lastDocBlock.length > 0 && lastDocBlock[0].includes('/**');
        if (hasDoc) {
          metrics.documentedFunctions!++;
        } else if (functionName && !functionName.startsWith('_')) {
          undocumentedSymbols.push(`function ${functionName}`);
        }
        if (!inBlockComment) lastDocBlock = [];
      }
      
      // Check for classes
      classRegex.lastIndex = 0; // Reset regex state
      const classMatch = classRegex.exec(line);
      if (classMatch) {
        metrics.totalClasses!++;
        const className = classMatch[1];
        const hasDoc = lastDocBlock.length > 0 && lastDocBlock[0].includes('/**');
        if (hasDoc) {
          metrics.documentedClasses!++;
        } else if (className) {
          undocumentedSymbols.push(`class ${className}`);
        }
        if (!inBlockComment) lastDocBlock = [];
      }
      
      // Count exports
      if (trimmedLine.startsWith('export')) {
        metrics.totalExports!++;
        if (lastDocBlock.length > 0 && i - lastDocBlock.length < 3) {
          metrics.documentedExports!++;
        }
      }
      
      // Clear doc block if we hit non-comment, non-function/class line  
      if (!inBlockComment && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('//') && 
          !functionMatch && !classMatch && trimmedLine.length > 0 && !trimmedLine.startsWith('export')) {
        lastDocBlock = [];
      }
    }
    
    // Calculate comment-to-code ratio
    const codeLines = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('*')).length;
    metrics.commentToCodeRatio = codeLines > 0 ? 
      ((metrics.inlineCommentLines! + metrics.blockCommentLines!) / codeLines) : 0;
    
    // Generate suggestions
    if (metrics.documentedFunctions! < metrics.totalFunctions! * 0.8) {
      suggestions.push('Add JSDoc comments to public functions');
    }
    if (metrics.documentedClasses! < metrics.totalClasses!) {
      suggestions.push('Document all classes with JSDoc comments');
    }
    if (metrics.commentToCodeRatio! < 0.1) {
      suggestions.push('Add more inline comments to explain complex logic');
    }
    if (metrics.todoCount! > 5) {
      suggestions.push(`Address ${metrics.todoCount} TODO comments`);
    }
    
    return {
      path: filePath,
      language: 'typescript',
      metrics,
      undocumentedSymbols: undocumentedSymbols.slice(0, 10), // Limit to first 10
      suggestions
    };
  }
  
  /**
   * Analyzes README and markdown files for completeness
   */
  async analyzeMarkdownDocs(content: string): Promise<{
    completeness: number;
    missingSection: string[];
    suggestions: string[];
  }> {
    const sections = {
      title: false,
      description: false,
      installation: false,
      usage: false,
      api: false,
      examples: false,
      contributing: false,
      license: false
    };
    
    const lowerContent = content.toLowerCase();
    
    // Check for key sections
    sections.title = /^#\s+\w+/m.test(content);
    sections.description = lowerContent.includes('## description') || 
                          lowerContent.includes('## overview') ||
                          lowerContent.includes('## about');
    sections.installation = lowerContent.includes('## install');
    sections.usage = lowerContent.includes('## usage') || 
                    lowerContent.includes('## getting started');
    sections.api = lowerContent.includes('## api') || 
                   lowerContent.includes('## reference');
    sections.examples = lowerContent.includes('## example') || 
                       lowerContent.includes('```');
    sections.contributing = lowerContent.includes('## contribut');
    sections.license = lowerContent.includes('## license') || 
                      lowerContent.includes('license');
    
    const completedSections = Object.values(sections).filter(v => v).length;
    const completeness = (completedSections / Object.keys(sections).length) * 100;
    
    const missingSections = Object.entries(sections)
      .filter(([_, present]) => !present)
      .map(([section, _]) => section);
    
    const suggestions: string[] = [];
    if (!sections.installation) suggestions.push('Add installation instructions');
    if (!sections.usage) suggestions.push('Add usage examples');
    if (!sections.api) suggestions.push('Add API documentation');
    if (!sections.examples) suggestions.push('Add code examples');
    
    return { completeness, missingSection: missingSections, suggestions };
  }
  
  /**
   * Analyzes a complete PR diff for documentation changes
   */
  async analyzePRDocumentation(
    diff: string, 
    changedFiles: string[]
  ): Promise<DocMetrics> {
    const aggregatedMetrics: DocMetrics = {
      totalFunctions: 0,
      documentedFunctions: 0,
      totalClasses: 0,
      documentedClasses: 0,
      totalMethods: 0,
      documentedMethods: 0,
      totalParameters: 0,
      documentedParameters: 0,
      totalExports: 0,
      documentedExports: 0,
      inlineCommentLines: 0,
      blockCommentLines: 0,
      todoCount: 0,
      fixmeCount: 0,
      commentToCodeRatio: 0,
      hasReadme: false,
      readmeCompleteness: 0,
      hasContributing: false,
      hasApiDocs: false,
      markdownFileCount: 0,
      overallDocScore: 0,
      codeDocScore: 0,
      projectDocScore: 0
    };
    
    // Count markdown files
    aggregatedMetrics.markdownFileCount = changedFiles.filter(f => 
      f.toLowerCase().endsWith('.md') || f.toLowerCase().endsWith('.markdown')
    ).length;
    
    aggregatedMetrics.hasReadme = changedFiles.some(f => 
      f.toLowerCase().includes('readme')
    );
    
    aggregatedMetrics.hasContributing = changedFiles.some(f => 
      f.toLowerCase().includes('contributing')
    );
    
    aggregatedMetrics.hasApiDocs = changedFiles.some(f => 
      f.toLowerCase().includes('api') && f.endsWith('.md')
    );
    
    // Parse diff for added documentation
    const diffLines = diff.split('\n');
    let currentFile = '';
    let addedContent: string[] = [];
    
    for (const line of diffLines) {
      // Track current file
      if (line.startsWith('diff --git')) {
        // Process previous file if it was TypeScript/JavaScript
        if (currentFile && (currentFile.endsWith('.ts') || currentFile.endsWith('.js'))) {
          const fileAnalysis = await this.analyzeTypeScriptDocs(
            addedContent.join('\n'), 
            currentFile
          );
          // Aggregate metrics
          this.aggregateMetrics(aggregatedMetrics, fileAnalysis.metrics);
        }
        
        // Reset for new file
        const fileMatch = line.match(/b\/(.+)$/);
        currentFile = fileMatch ? fileMatch[1] : '';
        addedContent = [];
      }
      
      // Collect added lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedContent.push(line.substring(1));
      }
    }
    
    // Process last file
    if (currentFile && (currentFile.endsWith('.ts') || currentFile.endsWith('.js'))) {
      const fileAnalysis = await this.analyzeTypeScriptDocs(
        addedContent.join('\n'), 
        currentFile
      );
      this.aggregateMetrics(aggregatedMetrics, fileAnalysis.metrics);
    }
    
    // Calculate overall scores
    aggregatedMetrics.codeDocScore = this.calculateCodeDocScore(aggregatedMetrics);
    aggregatedMetrics.projectDocScore = this.calculateProjectDocScore(aggregatedMetrics);
    aggregatedMetrics.overallDocScore = (
      aggregatedMetrics.codeDocScore * 0.6 + 
      aggregatedMetrics.projectDocScore * 0.4
    );
    
    return aggregatedMetrics;
  }
  
  private aggregateMetrics(target: DocMetrics, source: Partial<DocMetrics>) {
    for (const key of Object.keys(source) as (keyof DocMetrics)[]) {
      if (typeof source[key] === 'number' && typeof target[key] === 'number') {
        (target[key] as number) += source[key] as number;
      }
    }
  }
  
  private calculateCodeDocScore(metrics: DocMetrics): number {
    let score = 0;
    const weights = {
      functionDoc: 30,
      classDoc: 20,
      exportDoc: 20,
      commentRatio: 20,
      todoFixme: 10
    };
    
    // Function documentation score
    if (metrics.totalFunctions > 0) {
      score += (metrics.documentedFunctions / metrics.totalFunctions) * weights.functionDoc;
    } else {
      score += weights.functionDoc; // No functions, no penalty
    }
    
    // Class documentation score
    if (metrics.totalClasses > 0) {
      score += (metrics.documentedClasses / metrics.totalClasses) * weights.classDoc;
    } else {
      score += weights.classDoc;
    }
    
    // Export documentation score
    if (metrics.totalExports > 0) {
      score += (metrics.documentedExports / metrics.totalExports) * weights.exportDoc;
    } else {
      score += weights.exportDoc;
    }
    
    // Comment ratio score (target: 0.2 = 20% comments)
    const commentScore = Math.min(metrics.commentToCodeRatio / 0.2, 1) * weights.commentRatio;
    score += commentScore;
    
    // TODO/FIXME penalty
    const todoFixmePenalty = Math.max(0, 1 - (metrics.todoCount + metrics.fixmeCount) / 10);
    score += todoFixmePenalty * weights.todoFixme;
    
    return Math.round(score);
  }
  
  private calculateProjectDocScore(metrics: DocMetrics): number {
    let score = 0;
    
    if (metrics.hasReadme) score += 30;
    score += (metrics.readmeCompleteness / 100) * 20;
    if (metrics.hasContributing) score += 20;
    if (metrics.hasApiDocs) score += 20;
    if (metrics.markdownFileCount > 0) score += 10;
    
    return Math.round(score);
  }
  
  /**
   * Generate documentation improvement suggestions based on metrics
   */
  generateDocumentationSuggestions(metrics: DocMetrics): string[] {
    const suggestions: string[] = [];
    
    // Code documentation suggestions
    if (metrics.documentedFunctions < metrics.totalFunctions * 0.8) {
      const undocumentedCount = metrics.totalFunctions - metrics.documentedFunctions;
      suggestions.push(`Document ${undocumentedCount} functions missing JSDoc comments`);
    }
    
    if (metrics.documentedClasses < metrics.totalClasses) {
      const undocumentedCount = metrics.totalClasses - metrics.documentedClasses;
      suggestions.push(`Add class documentation for ${undocumentedCount} classes`);
    }
    
    if (metrics.commentToCodeRatio < 0.15) {
      suggestions.push('Increase inline documentation (aim for 15-20% comment-to-code ratio)');
    }
    
    if (metrics.todoCount + metrics.fixmeCount > 5) {
      suggestions.push(`Address ${metrics.todoCount + metrics.fixmeCount} TODO/FIXME comments`);
    }
    
    // Project documentation suggestions
    if (!metrics.hasReadme) {
      suggestions.push('Create or update README.md with project overview');
    } else if (metrics.readmeCompleteness < 80) {
      suggestions.push('Enhance README completeness (add missing sections)');
    }
    
    if (!metrics.hasContributing) {
      suggestions.push('Add CONTRIBUTING.md with contribution guidelines');
    }
    
    if (!metrics.hasApiDocs) {
      suggestions.push('Create API documentation for public interfaces');
    }
    
    if (metrics.overallDocScore < 70) {
      suggestions.push('Overall documentation needs improvement (current score: ' + 
                      metrics.overallDocScore + '/100)');
    }
    
    return suggestions;
  }
}