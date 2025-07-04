import { CodeQualityTools } from './code-quality-tools.js';

const codeQualityTools = new CodeQualityTools();

/**
 * Simplified code quality analysis function for integration with LangGraph agents
 */
export async function analyzeCodeQualityForAgent(diffContent: string, language?: string) {
  try {
    const metrics = codeQualityTools.analyzeCodeQuality(diffContent, language);
    
    return {
      success: true,
      data: {
        overallScore: calculateOverallScore(metrics),
        complexity: {
          cyclomatic: metrics.cyclomaticComplexity.average,
          cognitive: metrics.cognitiveComplexity.average,
          maxNesting: metrics.nestingDepth.maximum,
          avgFunctionLength: metrics.functionLength.average
        },
        maintainability: {
          duplication: metrics.codeDuplication.percentage,
          namingScore: metrics.namingConventions.overall,
          solidScore: metrics.solidPrinciples.overall,
          codeSmells: metrics.codeSmells.length
        },
        bestPractices: {
          languageIdioms: metrics.languageIdioms.overall,
          antiPatterns: metrics.antiPatterns.length,
          designPatterns: metrics.designPatterns.length
        },
        recommendations: generateRecommendations(metrics)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during code quality analysis'
    };
  }
}

/**
 * Calculate complexity metrics for code content
 */
export async function calculateComplexityForAgent(codeContent: string, language?: string) {
  try {
    const mockDiff = `diff --git a/temp.${getExtension(language)} b/temp.${getExtension(language)}\n+${codeContent.split('\n').map((line: string) => `+${line}`).join('\n+')}`;
    const metrics = codeQualityTools.analyzeCodeQuality(mockDiff, language);
    
    return {
      success: true,
      data: {
        cyclomaticComplexity: metrics.cyclomaticComplexity.average,
        cognitiveComplexity: metrics.cognitiveComplexity.average,
        maxNestingDepth: metrics.nestingDepth.maximum,
        violations: metrics.cyclomaticComplexity.violationsCount,
        recommendations: metrics.cyclomaticComplexity.violationsCount > 0 
          ? ['Reduce complexity by breaking down functions into smaller units']
          : ['Code complexity is within acceptable limits']
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during complexity calculation'
    };
  }
}

/**
 * Detect code smells and anti-patterns
 */
export async function detectCodeSmellsForAgent(diffContent: string, language?: string) {
  try {
    const metrics = codeQualityTools.analyzeCodeQuality(diffContent, language);
    
    const codeSmells = metrics.codeSmells.map(smell => ({
      type: smell.type,
      file: smell.file,
      line: smell.line,
      severity: smell.severity,
      description: smell.description,
      suggestion: smell.suggestion
    }));
    
    const antiPatterns = metrics.antiPatterns.map(pattern => ({
      type: pattern.type,
      file: pattern.file,
      impact: pattern.impact,
      description: pattern.description,
      refactoringGuide: pattern.refactoringGuide
    }));
    
    return {
      success: true,
      data: {
        codeSmells,
        antiPatterns,
        summary: {
          totalCodeSmells: codeSmells.length,
          totalAntiPatterns: antiPatterns.length,
          highSeverityIssues: codeSmells.filter(s => s.severity === 'high').length,
          highImpactPatterns: antiPatterns.filter(p => p.impact === 'high').length
        },
        recommendations: generateSmellRecommendations(codeSmells, antiPatterns)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during code smell detection'
    };
  }
}

// Helper functions
function calculateOverallScore(metrics: any): number {
  const complexityScore = Math.max(0, 100 - (metrics.cyclomaticComplexity.average * 2 + metrics.cognitiveComplexity.average * 1.5));
  const maintainabilityScore = (metrics.namingConventions.overall + metrics.solidPrinciples.overall) / 2;
  const duplicationPenalty = metrics.codeDuplication.percentage * 10;
  const smellsPenalty = metrics.codeSmells.length * 5;
  const antiPatternsPenalty = metrics.antiPatterns.length * 10;
  
  return Math.max(0, Math.round((complexityScore * 0.4 + maintainabilityScore * 0.4 + metrics.languageIdioms.overall * 0.2) - duplicationPenalty - smellsPenalty - antiPatternsPenalty));
}

function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.cyclomaticComplexity.average > 10) {
    recommendations.push('Reduce cyclomatic complexity by breaking down complex functions');
  }
  if (metrics.cognitiveComplexity.average > 15) {
    recommendations.push('Simplify cognitive complexity by reducing nested conditions');
  }
  if (metrics.nestingDepth.maximum > 4) {
    recommendations.push('Reduce nesting depth by using early returns or extracting methods');
  }
  if (metrics.codeDuplication.percentage > 5) {
    recommendations.push('Address code duplication by extracting common functionality');
  }
  if (metrics.namingConventions.overall < 80) {
    recommendations.push('Improve naming conventions for better code readability');
  }
  if (metrics.solidPrinciples.overall < 80) {
    recommendations.push('Review SOLID principles adherence to improve design quality');
  }
  if (metrics.codeSmells.length > 5) {
    recommendations.push('Address identified code smells to improve maintainability');
  }
  if (metrics.antiPatterns.length > 0) {
    recommendations.push('Refactor anti-patterns to follow best practices');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Code quality appears to be good - continue following current practices');
  }
  
  return recommendations;
}

function generateSmellRecommendations(codeSmells: any[], antiPatterns: any[]): string[] {
  const recommendations: string[] = [];
  
  if (codeSmells.length > 0) {
    const smellTypes = [...new Set(codeSmells.map(s => s.type))];
    for (const smellType of smellTypes) {
      switch (smellType) {
        case 'Long Parameter List':
          recommendations.push('Use parameter objects or builder pattern to reduce parameter lists');
          break;
        case 'Large Class':
          recommendations.push('Break down large classes into smaller, focused classes');
          break;
        case 'Dead Code':
          recommendations.push('Remove unused or unreachable code');
          break;
        default:
          recommendations.push(`Address ${smellType} code smell`);
      }
    }
  }
  
  if (antiPatterns.length > 0) {
    const patternTypes = [...new Set(antiPatterns.map(p => p.type))];
    for (const patternType of patternTypes) {
      switch (patternType) {
        case 'God Object':
          recommendations.push('Split god objects into focused, single-responsibility classes');
          break;
        case 'Copy-Paste Programming':
          recommendations.push('Extract common functionality to eliminate copy-paste programming');
          break;
        case 'Spaghetti Code':
          recommendations.push('Refactor complex control flow into smaller, manageable functions');
          break;
        default:
          recommendations.push(`Refactor ${patternType} anti-pattern`);
      }
    }
  }
  
  return recommendations;
}

function getExtension(language?: string): string {
  const extensionMap: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'cs',
    'ruby': 'rb',
    'go': 'go',
    'php': 'php'
  };
  
  return extensionMap[language || 'javascript'] || 'txt';
}

// Export the core tools class for direct usage
export { CodeQualityTools };