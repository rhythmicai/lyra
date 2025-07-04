import { GitHubPR, PRMetrics, AnalysisResult } from '../types/index.js';

export class AnalysisTools {
  
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
    
    // Merge time-based findings with pattern analysis findings
    const allFindings = [...analysis.findings, ...timeBasedFindings];

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
        averagePRSize
      },
      findings: allFindings,
      recommendations: analysis.recommendations,
      risks: analysis.risks
    };
  }
}