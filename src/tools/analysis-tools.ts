import { GitHubPR, PRMetrics, AnalysisResult, ComplexityAnalysisSummary, MaintainabilityAnalysisSummary, BestPracticesAnalysisSummary } from '../types/index.js';
import { CodeQualityTools } from './code-quality-tools.js';

export class AnalysisTools {
  private codeQualityTools: CodeQualityTools;

  constructor() {
    this.codeQualityTools = new CodeQualityTools();
  }
  
  selectPRs(prs: GitHubPR[], criteria: string): GitHubPR[] {
    const sorted = [...prs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Parse selection criteria
    if (criteria.startsWith('last ')) {
      const n = parseInt(criteria.split(' ')[1]) || 5;
      return sorted.slice(0, n);
    }

    if (criteria.startsWith('largest ')) {
      const n = parseInt(criteria.split(' ')[1]) || 5;
      return [...prs]
        .filter(pr => pr.additions !== undefined)
        .sort((a, b) => (b.additions! + b.deletions!) - (a.additions! + a.deletions!))
        .slice(0, n);
    }

    if (criteria === 'unreviewed') {
      // This would need review data - for now return recent PRs
      return sorted.filter(pr => pr.state === 'OPEN').slice(0, 10);
    }

    if (criteria === 'last-week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sorted.filter(pr => new Date(pr.createdAt) >= weekAgo);
    }

    if (criteria === 'last-30-days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return sorted.filter(pr => new Date(pr.createdAt) >= thirtyDaysAgo);
    }

    if (criteria === 'last-90-days') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return sorted.filter(pr => new Date(pr.createdAt) >= ninetyDaysAgo);
    }

    if (criteria === 'open') {
      return sorted.filter(pr => pr.state === 'OPEN');
    }

    // Default: last 5
    return sorted.slice(0, 5);
  }

  analyzePRPatterns(prs: GitHubPR[], metrics: Record<string, PRMetrics>): {
    findings: string[];
    recommendations: string[];
    risks: Array<{ level: 'high' | 'medium' | 'low'; description: string }>;
  } {
    const findings: string[] = [];
    const recommendations: string[] = [];
    const risks: Array<{ level: 'high' | 'medium' | 'low'; description: string }> = [];

    // Analyze merge rate
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED').length;
    const mergeRate = prs.length > 0 ? (mergedPRs / prs.length) * 100 : 0;

    if (mergeRate < 50) {
      findings.push(`Low merge rate detected: ${mergeRate.toFixed(1)}%`);
      risks.push({
        level: 'high',
        description: 'Low merge rate indicates potential workflow issues'
      });
      recommendations.push('Investigate PR review and merge process');
    }

    // Analyze test coverage
    const metricsArray = Object.values(metrics);
    if (metricsArray.length > 0) {
      const avgTestRatio = metricsArray.reduce((sum, m) => 
        sum + (m.totalAdditions > 0 ? m.testAdditions / m.totalAdditions : 0), 0
      ) / metricsArray.length;

      if (avgTestRatio < 0.2) {
        findings.push(`Low test coverage: ${(avgTestRatio * 100).toFixed(1)}% average test-to-code ratio`);
        risks.push({
          level: 'high',
          description: 'Insufficient test coverage increases regression risk'
        });
        recommendations.push('Implement mandatory test coverage requirements');
      }
    }

    // Analyze PR sizes
    const largePRs = prs.filter(pr => 
      (pr.additions || 0) + (pr.deletions || 0) > 1000
    );
    
    if (largePRs.length > prs.length * 0.3) {
      findings.push(`${largePRs.length} PRs exceed 1000 changes`);
      risks.push({
        level: 'medium',
        description: 'Large PRs are difficult to review effectively'
      });
      recommendations.push('Break down large PRs into smaller, focused changes');
    }

    // Analyze documentation
    const avgDocRatio = metricsArray.reduce((sum, m) =>
      sum + (m.totalAdditions > 0 ? m.docAdditions / m.totalAdditions : 0), 0
    ) / Math.max(metricsArray.length, 1);

    if (avgDocRatio < 0.05) {
      findings.push('Low documentation updates relative to code changes');
      recommendations.push('Improve documentation practices and requirements');
    }

    // Security patterns
    const securityConcerns = metricsArray.filter(m => m.securityPatternMatches > 0);
    if (securityConcerns.length > 0) {
      findings.push(`${securityConcerns.length} PRs contain potential security-sensitive changes`);
      recommendations.push('Review security-sensitive changes carefully');
    }

    return { findings, recommendations, risks };
  }

  /**
   * Enrich PR metrics with code quality analysis
   */
  async enrichWithCodeQuality(
    metrics: Record<string, PRMetrics>, 
    getDiffContentFn: (prKey: string) => Promise<string>
  ): Promise<Record<string, PRMetrics>> {
    const enrichedMetrics: Record<string, PRMetrics> = {};
    
    for (const [prKey, prMetric] of Object.entries(metrics)) {
      try {
        const diffContent = await getDiffContentFn(prKey);
        const codeQualityMetrics = this.codeQualityTools.analyzeCodeQuality(diffContent);
        
        enrichedMetrics[prKey] = {
          ...prMetric,
          codeQualityMetrics
        };
      } catch (error) {
        console.warn(`Failed to analyze code quality for ${prKey}:`, error);
        enrichedMetrics[prKey] = prMetric; // Keep original if analysis fails
      }
    }
    
    return enrichedMetrics;
  }

  /**
   * Generate code quality analysis summary from enriched metrics
   */
  generateCodeQualityAnalysis(metrics: Record<string, PRMetrics>): {
    overallScore: number;
    complexityAnalysis: ComplexityAnalysisSummary;
    maintainabilityAnalysis: MaintainabilityAnalysisSummary;
    bestPracticesAnalysis: BestPracticesAnalysisSummary;
  } {
    const metricsWithQuality = Object.values(metrics).filter(m => m.codeQualityMetrics);
    
    if (metricsWithQuality.length === 0) {
      // Return default values if no code quality metrics available
      return {
        overallScore: 0,
        complexityAnalysis: {
          averageCyclomaticComplexity: 0,
          averageCognitiveComplexity: 0,
          maxNestingDepth: 0,
          averageFunctionLength: 0,
          highComplexityFiles: [],
          recommendations: ['No code quality metrics available for analysis']
        },
        maintainabilityAnalysis: {
          duplicationPercentage: 0,
          namingConventionScore: 0,
          solidPrinciplesScore: 0,
          codeSmellsCount: 0,
          criticalIssues: [],
          recommendations: ['No maintainability metrics available for analysis']
        },
        bestPracticesAnalysis: {
          languageIdiomScore: 0,
          designPatternUsage: 0,
          antiPatternsCount: 0,
          bestPracticeViolations: [],
          recommendations: ['No best practices metrics available for analysis']
        }
      };
    }

    // Aggregate complexity metrics
    const complexityMetrics = metricsWithQuality.map(m => m.codeQualityMetrics!);
    const avgCyclomaticComplexity = complexityMetrics.reduce((sum, m) => sum + m.cyclomaticComplexity.average, 0) / complexityMetrics.length;
    const avgCognitiveComplexity = complexityMetrics.reduce((sum, m) => sum + m.cognitiveComplexity.average, 0) / complexityMetrics.length;
    const maxNestingDepth = Math.max(...complexityMetrics.map(m => m.nestingDepth.maximum));
    const avgFunctionLength = complexityMetrics.reduce((sum, m) => sum + m.functionLength.average, 0) / complexityMetrics.length;
    
    // Identify high complexity files
    const highComplexityFiles: string[] = [];
    complexityMetrics.forEach(m => {
      m.cyclomaticComplexity.files.forEach(f => {
        if (f.score > 10) {
          highComplexityFiles.push(f.path);
        }
      });
    });

    // Aggregate maintainability metrics
    const avgDuplicationPercentage = complexityMetrics.reduce((sum, m) => sum + m.codeDuplication.percentage, 0) / complexityMetrics.length;
    const avgNamingScore = complexityMetrics.reduce((sum, m) => sum + m.namingConventions.overall, 0) / complexityMetrics.length;
    const avgSolidScore = complexityMetrics.reduce((sum, m) => sum + m.solidPrinciples.overall, 0) / complexityMetrics.length;
    const totalCodeSmells = complexityMetrics.reduce((sum, m) => sum + m.codeSmells.length, 0);

    // Aggregate best practices metrics
    const avgLanguageIdiomScore = complexityMetrics.reduce((sum, m) => sum + m.languageIdioms.overall, 0) / complexityMetrics.length;
    const totalAntiPatterns = complexityMetrics.reduce((sum, m) => sum + m.antiPatterns.length, 0);
    const totalDesignPatterns = complexityMetrics.reduce((sum, m) => sum + m.designPatterns.length, 0);

    // Generate recommendations
    const complexityRecommendations: string[] = [];
    if (avgCyclomaticComplexity > 10) {
      complexityRecommendations.push('Reduce cyclomatic complexity by breaking down complex functions');
    }
    if (avgCognitiveComplexity > 15) {
      complexityRecommendations.push('Simplify cognitive complexity by reducing nested conditions');
    }
    if (maxNestingDepth > 4) {
      complexityRecommendations.push('Reduce nesting depth by extracting methods or using early returns');
    }
    if (avgFunctionLength > 50) {
      complexityRecommendations.push('Break down long functions into smaller, more focused functions');
    }

    const maintainabilityRecommendations: string[] = [];
    if (avgDuplicationPercentage > 5) {
      maintainabilityRecommendations.push('Reduce code duplication by extracting common functionality');
    }
    if (avgNamingScore < 80) {
      maintainabilityRecommendations.push('Improve naming conventions for better code readability');
    }
    if (avgSolidScore < 80) {
      maintainabilityRecommendations.push('Review SOLID principles adherence to improve code design');
    }
    if (totalCodeSmells > 10) {
      maintainabilityRecommendations.push('Address identified code smells to improve maintainability');
    }

    const bestPracticesRecommendations: string[] = [];
    if (avgLanguageIdiomScore < 80) {
      bestPracticesRecommendations.push('Follow language-specific idioms and best practices');
    }
    if (totalAntiPatterns > 0) {
      bestPracticesRecommendations.push('Refactor identified anti-patterns to improve code quality');
    }

    // Calculate overall score (weighted average)
    const complexityScore = Math.max(0, 100 - (avgCyclomaticComplexity * 2 + avgCognitiveComplexity * 1.5 + maxNestingDepth * 5));
    const maintainabilityScore = (avgNamingScore + avgSolidScore + Math.max(0, 100 - avgDuplicationPercentage * 10)) / 3;
    const bestPracticesScore = Math.max(0, avgLanguageIdiomScore - totalAntiPatterns * 10);
    
    const overallScore = (complexityScore * 0.4 + maintainabilityScore * 0.4 + bestPracticesScore * 0.2);

    return {
      overallScore: Math.round(overallScore),
      complexityAnalysis: {
        averageCyclomaticComplexity: Math.round(avgCyclomaticComplexity * 10) / 10,
        averageCognitiveComplexity: Math.round(avgCognitiveComplexity * 10) / 10,
        maxNestingDepth,
        averageFunctionLength: Math.round(avgFunctionLength),
        highComplexityFiles: [...new Set(highComplexityFiles)],
        recommendations: complexityRecommendations
      },
      maintainabilityAnalysis: {
        duplicationPercentage: Math.round(avgDuplicationPercentage * 10) / 10,
        namingConventionScore: Math.round(avgNamingScore),
        solidPrinciplesScore: Math.round(avgSolidScore),
        codeSmellsCount: totalCodeSmells,
        criticalIssues: [],
        recommendations: maintainabilityRecommendations
      },
      bestPracticesAnalysis: {
        languageIdiomScore: Math.round(avgLanguageIdiomScore),
        designPatternUsage: totalDesignPatterns,
        antiPatternsCount: totalAntiPatterns,
        bestPracticeViolations: [],
        recommendations: bestPracticesRecommendations
      }
    };
  }

  generateAnalysisResult(
    prs: GitHubPR[],
    metrics: Record<string, PRMetrics>,
    config: any,
    activityData?: any
  ): AnalysisResult {
    const metricsArray = Object.values(metrics);
    
    const totalAdditions = metricsArray.reduce((sum, m) => sum + m.totalAdditions, 0);
    const totalDeletions = metricsArray.reduce((sum, m) => sum + m.totalDeletions, 0);
    const totalTestAdditions = metricsArray.reduce((sum, m) => sum + m.testAdditions, 0);
    const totalDocAdditions = metricsArray.reduce((sum, m) => sum + m.docAdditions, 0);
    
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED').length;
    const mergeRate = prs.length > 0 ? (mergedPRs / prs.length) * 100 : 0;
    
    // Add time-based findings if activity data is available
    const timeBasedFindings: string[] = [];
    if (activityData?.summary) {
      const last30DayRate = parseFloat(activityData.summary.last30Days?.mergeRate || '0');
      const last90DayRate = parseFloat(activityData.summary.last90Days?.mergeRate || '0');
      
      if (last30DayRate < last90DayRate - 10) {
        timeBasedFindings.push(`Merge rate declining: ${last30DayRate}% (30d) vs ${last90DayRate}% (90d)`);
      } else if (last30DayRate > last90DayRate + 10) {
        timeBasedFindings.push(`Merge rate improving: ${last30DayRate}% (30d) vs ${last90DayRate}% (90d)`);
      }
      
      if (activityData.summary.last30Days?.totalPRs < 5) {
        timeBasedFindings.push('Low activity in the last 30 days');
      }
    }
    
    const averagePRSize = prs.length > 0 
      ? prs.reduce((sum, pr) => sum + (pr.additions || 0) + (pr.deletions || 0), 0) / prs.length
      : 0;

    const testToCodeRatio = totalAdditions > 0 
      ? (totalTestAdditions / totalAdditions) * 100 
      : 0;

    const analysis = this.analyzePRPatterns(prs, metrics);
    
    // Generate code quality analysis
    const codeQuality = this.generateCodeQualityAnalysis(metrics);
    
    // Add code quality findings
    const codeQualityFindings: string[] = [];
    if (codeQuality.overallScore < 70) {
      codeQualityFindings.push(`Low code quality score: ${codeQuality.overallScore}/100`);
    }
    if (codeQuality.complexityAnalysis.averageCyclomaticComplexity > 10) {
      codeQualityFindings.push(`High cyclomatic complexity: ${codeQuality.complexityAnalysis.averageCyclomaticComplexity} average`);
    }
    if (codeQuality.maintainabilityAnalysis.duplicationPercentage > 5) {
      codeQualityFindings.push(`Code duplication detected: ${codeQuality.maintainabilityAnalysis.duplicationPercentage}%`);
    }
    if (codeQuality.bestPracticesAnalysis.antiPatternsCount > 0) {
      codeQualityFindings.push(`${codeQuality.bestPracticesAnalysis.antiPatternsCount} anti-patterns detected`);
    }
    
    // Merge time-based findings with pattern analysis findings and code quality findings
    const allFindings = [...analysis.findings, ...timeBasedFindings, ...codeQualityFindings];
    
    // Calculate additional metrics
    const averageComplexity = codeQuality.complexityAnalysis.averageCyclomaticComplexity;
    const maintainabilityIndex = (codeQuality.maintainabilityAnalysis.namingConventionScore + 
                                  codeQuality.maintainabilityAnalysis.solidPrinciplesScore) / 2;

    return {
      totalPRsAnalyzed: prs.length,
      reviewFocus: config.reviewFocus,
      selectionCriteria: config.prSelection,
      analysisDate: new Date().toISOString().split('T')[0],
      metrics: {
        totalAdditions,
        totalDeletions,
        totalTestAdditions,
        totalDocAdditions,
        testToCodeRatio,
        mergeRate,
        averagePRSize,
        averageComplexity,
        codeQualityScore: codeQuality.overallScore,
        maintainabilityIndex
      },
      findings: allFindings,
      recommendations: analysis.recommendations,
      risks: analysis.risks,
      codeQuality
    };
  }
}