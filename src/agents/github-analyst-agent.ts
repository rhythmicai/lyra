import { StateGraph, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { GitHubTools } from '../tools/github-tools.js';
import { AnalysisTools } from '../tools/analysis-tools.js';
import { CoachingTools } from '../tools/coaching-tools.js';
import { AnalysisConfig, AnalysisResult, PRMetrics } from '../types/index.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { traceable } from 'langsmith/traceable';

// Define the state annotation
const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  config: Annotation<AnalysisConfig>,
  overviewData: Annotation<any>,
  selectedPRs: Annotation<any[]>,
  prAnalysis: Annotation<Record<string, PRMetrics>>,
  finalReport: Annotation<AnalysisResult>,
  coachingReport: Annotation<string>,
  currentStep: Annotation<string>,
  error: Annotation<string>,
});

type GraphState = typeof GraphAnnotation.State;

export class GitHubAnalystAgent {
  private model: ChatOpenAI;
  private githubTools: GitHubTools;
  private analysisTools: AnalysisTools;
  private coachingTools: CoachingTools;
  private graph: any;

  constructor(githubToken: string, openaiApiKey: string, modelName: string = 'gpt-4-turbo-preview') {
    this.model = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName,
      temperature: 0.2,
    });

    this.githubTools = new GitHubTools(githubToken);
    this.analysisTools = new AnalysisTools();
    this.coachingTools = new CoachingTools(openaiApiKey, modelName);
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(GraphAnnotation)
      .addNode('generate_overview', this._generateOverview.bind(this))
      .addNode('select_prs', this._selectPRs.bind(this))
      .addNode('analyze_prs', this._analyzePRs.bind(this))
      .addNode('generate_report', this._generateReport.bind(this))
      .addNode('generate_coaching', this._generateCoaching.bind(this))
      .addNode('save_results', this._saveResults.bind(this))
      .addEdge('__start__', 'generate_overview')
      .addEdge('generate_overview', 'select_prs')
      .addEdge('select_prs', 'analyze_prs')
      .addEdge('analyze_prs', 'generate_report')
      .addEdge('generate_report', 'generate_coaching')
      .addEdge('generate_coaching', 'save_results')
      .addEdge('save_results', '__end__');

    return workflow.compile();
  }

  private async _generateOverview(state: GraphState): Promise<Partial<GraphState>> {
    try {
      console.log('🔍 Generating GitHub activity overview...');
      
      const username = state.config.username || await this.getUsername();
      const reportPath = await this.githubTools.generateActivityReport(
        username,
        state.config.outputDir || './insights'
      );

      const overviewData = {
        username,
        reportPath,
        generatedAt: new Date().toISOString()
      };

      return {
        overviewData,
        currentStep: 'overview_complete',
        messages: [
          ...state.messages,
          new AIMessage(`Generated activity overview for user ${username}`)
        ]
      };
    } catch (error) {
      return {
        error: `Failed to generate overview: ${error}`,
        currentStep: 'error'
      };
    }
  }

  private async _selectPRs(state: GraphState): Promise<Partial<GraphState>> {
    try {
      console.log('📋 Selecting PRs for analysis...');
      
      const username = state.config.username || state.overviewData?.username || await this.getUsername();
      let query = `author:${username}`;
      
      if (state.config.repoFilter) {
        query += ` repo:${state.config.repoFilter}`;
      }

      const allPRs = await this.githubTools.searchPRs(query, 200);
      const selectedPRs = this.analysisTools.selectPRs(allPRs, state.config.prSelection);

      console.log(`Selected ${selectedPRs.length} PRs for deep analysis`);

      return {
        selectedPRs,
        currentStep: 'prs_selected',
        messages: [
          ...state.messages,
          new AIMessage(`Selected ${selectedPRs.length} PRs based on criteria: ${state.config.prSelection}`)
        ]
      };
    } catch (error) {
      return {
        error: `Failed to select PRs: ${error}`,
        currentStep: 'error'
      };
    }
  }

  private async _analyzePRs(state: GraphState): Promise<Partial<GraphState>> {
      try {
        console.log('🔬 Analyzing selected PRs...');
        
        const prAnalysis: Record<string, PRMetrics> = {};
        
        for (const pr of state.selectedPRs || []) {
          const [owner, repo] = pr.repository.nameWithOwner.split('/');
          console.log(`  Analyzing PR #${pr.number} in ${pr.repository.nameWithOwner}`);
          
          try {
            const prDetails = await this.githubTools.getPRDetails(owner, repo, pr.number);
            const diff = await this.githubTools.getPRDiff(owner, repo, pr.number);
            const metrics = await this.githubTools.analyzePRMetrics(diff, prDetails, owner, repo, pr.number);
            
            // Update PR with additions/deletions from details
            pr.additions = prDetails.additions;
            pr.deletions = prDetails.deletions;
            pr.changedFiles = prDetails.changedFiles;
            
            prAnalysis[`${pr.repository.nameWithOwner}#${pr.number}`] = metrics;
          } catch (error) {
            console.warn(`  ⚠️  Failed to analyze PR #${pr.number}: ${error}`);
          }
        }

        return {
          prAnalysis,
          currentStep: 'analysis_complete',
          messages: [
            ...state.messages,
            new AIMessage(`Completed analysis of ${Object.keys(prAnalysis).length} PRs`)
          ]
        };
      } catch (error) {
        return {
          error: `Failed to analyze PRs: ${error}`,
          currentStep: 'error'
        };
      }
  }

  private async _generateCoaching(state: GraphState): Promise<Partial<GraphState>> {
      try {
        console.log('🎯 Generating personalized coaching advice...');
        
        // Read the activity report JSON
        const reportPath = state.overviewData?.reportPath;
        if (!reportPath) {
          throw new Error('Activity report path not found');
        }
        
        const activityData = JSON.parse(await readFile(reportPath, 'utf-8'));
        const username = state.config.username || state.overviewData?.username || 'Developer';
        
        // Generate coaching advice
        const coachingAdvice = await this.coachingTools.generateCoachingAdvice(
          activityData,
          state.finalReport!,
          username
        );
        
        const coachingReport = this.coachingTools.formatCoachingReport(coachingAdvice, username);
        
        return {
          coachingReport,
          currentStep: 'coaching_complete',
          messages: [
            ...state.messages,
            new AIMessage('Generated personalized coaching advice and development plan')
          ]
        };
      } catch (error) {
        return {
          error: `Failed to generate coaching advice: ${error}`,
          currentStep: 'error'
        };
      }
  }

  private async _generateReport(state: GraphState): Promise<Partial<GraphState>> {
      try {
        console.log('📊 Generating comprehensive report...');
        
        // Read the activity report for time-based metrics
        let activityData = null;
        if (state.overviewData?.reportPath) {
          try {
            activityData = JSON.parse(await readFile(state.overviewData.reportPath, 'utf-8'));
          } catch (e) {
            console.warn('Could not read activity report:', e);
          }
        }
        
        const result = this.analysisTools.generateAnalysisResult(
          state.selectedPRs || [],
          state.prAnalysis || {},
          state.config,
          activityData
        );

        // Use AI to generate insights
        const prompt = `
Analyze the following GitHub repository metrics and provide specific, actionable insights:

Review Focus: ${state.config.reviewFocus}

Metrics:
- Total PRs analyzed: ${result.totalPRsAnalyzed}
- Merge rate: ${result.metrics.mergeRate.toFixed(1)}%
- Average PR size: ${result.metrics.averagePRSize.toFixed(0)} changes
- Test-to-code ratio: ${result.metrics.testToCodeRatio.toFixed(1)}%
- Documentation ratio: ${(result.metrics.totalDocAdditions / Math.max(result.metrics.totalAdditions, 1) * 100).toFixed(1)}%

Current Findings:
${result.findings.join('\n')}

Based on this data and the review focus, provide:
1. 3-5 additional specific insights about code quality and development practices
2. 3-5 concrete recommendations for improvement
3. Identify any patterns or trends that need attention

Format your response as JSON with arrays for "insights" and "recommendations".
`;

        const aiResponse = await this.model.invoke([new HumanMessage(prompt)]);
        let content = aiResponse.content as string;
        
        // Clean up the response - remove markdown code blocks if present
        content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        
        const aiInsights = JSON.parse(content);

        // Merge AI insights with automated findings
        result.findings = [...result.findings, ...aiInsights.insights];
        result.recommendations = [...result.recommendations, ...aiInsights.recommendations];

        return {
          finalReport: result,
          currentStep: 'report_complete',
          messages: [
            ...state.messages,
            new AIMessage('Generated comprehensive analysis report with AI insights')
          ]
        };
      } catch (error) {
        return {
          error: `Failed to generate report: ${error}`,
          currentStep: 'error'
        };
      }
  }

  private async _saveResults(state: GraphState): Promise<Partial<GraphState>> {
      try {
        console.log('💾 Saving analysis results...');
        
        const outputDir = state.config.outputDir || './insights';
        const username = state.config.username || state.overviewData?.username || 'unknown';
        const date = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
        const analysisDir = join(outputDir, username, date, `analysis-${timestamp}`);
        
        await mkdir(analysisDir, { recursive: true });
        
        // Read activity data for time-based metrics
        let activityData = null;
        if (state.overviewData?.reportPath) {
          try {
            activityData = JSON.parse(await readFile(state.overviewData.reportPath, 'utf-8'));
          } catch (e) {
            console.warn('Could not read activity report:', e);
          }
        }

        // Save the comprehensive report
        const reportPath = join(analysisDir, `${username}-COMPREHENSIVE_ASSESSMENT.md`);
        if (state.finalReport) {
          await writeFile(reportPath, this.formatMarkdownReport(state.finalReport, username, activityData));
        } else {
          console.error('❌ No final report generated!');
          throw new Error('Final report is missing from state');
        }

        // Save the coaching report
        if (state.coachingReport) {
          const coachingPath = join(analysisDir, `${username}-COACHING_ADVICE.md`);
          await writeFile(coachingPath, state.coachingReport);
        }

        // Save raw data
        await writeFile(
          join(analysisDir, `${username}-analysis-data.json`),
          JSON.stringify({
            config: state.config,
            selectedPRs: state.selectedPRs,
            metrics: state.prAnalysis,
            report: state.finalReport
          }, null, 2)
        );

        console.log(`\n✅ Analysis complete! Results saved to: ${analysisDir}`);
        console.log('\n📁 Generated files:');
        console.log(`   📊 ${username}-COMPREHENSIVE_ASSESSMENT.md - Technical analysis and metrics`);
        console.log(`   🎯 ${username}-COACHING_ADVICE.md - Personalized development coaching`);
        console.log(`   📄 ${username}-analysis-data.json - Raw data for further processing`);

        return {
          currentStep: 'complete',
          messages: [
            ...state.messages,
            new AIMessage(`Analysis complete. Results saved to ${analysisDir}`)
          ]
        };
      } catch (error) {
        return {
          error: `Failed to save results: ${error}`,
          currentStep: 'error'
        };
      }
  }

  private formatMarkdownReport(report: any, username?: string, activityData?: any): string {
    const date = new Date().toISOString().split('T')[0];
    
    return `# GitHub Code Quality Assessment

**Date:** ${date}  
**User:** ${username || 'authenticated user'}  
**Review Focus:** ${report.reviewFocus}  
**PRs Analyzed:** ${report.totalPRsAnalyzed}  
**Selection Criteria:** ${report.selectionCriteria}

## Executive Summary

This analysis examined ${report.totalPRsAnalyzed} pull requests to assess code quality, development practices, and areas for improvement.

### Key Metrics

| Metric | Value |
|--------|--------|
| Merge Rate | ${report.metrics.mergeRate.toFixed(1)}% |
| Average PR Size | ${report.metrics.averagePRSize.toFixed(0)} changes |
| Test-to-Code Ratio | ${report.metrics.testToCodeRatio.toFixed(1)}% |
| Documentation Updates | ${report.metrics.totalDocAdditions} lines |
| Total Code Changes | +${report.metrics.totalAdditions} / -${report.metrics.totalDeletions} |

### Activity Trends

| Period | Total PRs | Merged PRs | Merge Rate |
|--------|-----------|------------|------------|
| All Time | ${activityData?.summary?.totalPRs || 'N/A'} | ${activityData?.summary?.mergedPRs || 'N/A'} | ${activityData?.summary?.mergeRate || 'N/A'}% |
| Last 90 Days | ${activityData?.summary?.last90Days?.totalPRs || 'N/A'} | ${activityData?.summary?.last90Days?.mergedPRs || 'N/A'} | ${activityData?.summary?.last90Days?.mergeRate || 'N/A'}% |
| Last 30 Days | ${activityData?.summary?.last30Days?.totalPRs || 'N/A'} | ${activityData?.summary?.last30Days?.mergedPRs || 'N/A'} | ${activityData?.summary?.last30Days?.mergeRate || 'N/A'}% |

### Performance Analysis

| Category | Issues Found | Risk Level |
|----------|--------------|------------|
| Total Performance Issues | ${report.metrics.performanceSummary.totalPerformanceIssues} | ${report.metrics.performanceSummary.totalPerformanceIssues > 10 ? 'HIGH' : report.metrics.performanceSummary.totalPerformanceIssues > 5 ? 'MEDIUM' : 'LOW'} |
| High Risk Issues | ${report.metrics.performanceSummary.highRiskIssues} | ${report.metrics.performanceSummary.highRiskIssues > 5 ? 'HIGH' : report.metrics.performanceSummary.highRiskIssues > 2 ? 'MEDIUM' : 'LOW'} |
| Database Issues | ${report.metrics.performanceSummary.databaseIssues} | ${report.metrics.performanceSummary.databaseIssues > 5 ? 'HIGH' : report.metrics.performanceSummary.databaseIssues > 2 ? 'MEDIUM' : 'LOW'} |
| Code Quality Issues | ${report.metrics.performanceSummary.codeQualityIssues} | ${report.metrics.performanceSummary.codeQualityIssues > 5 ? 'HIGH' : report.metrics.performanceSummary.codeQualityIssues > 2 ? 'MEDIUM' : 'LOW'} |
| Runtime Issues | ${report.metrics.performanceSummary.runtimeIssues} | ${report.metrics.performanceSummary.runtimeIssues > 5 ? 'HIGH' : report.metrics.performanceSummary.runtimeIssues > 2 ? 'MEDIUM' : 'LOW'} |
| Frontend Issues | ${report.metrics.performanceSummary.frontendIssues} | ${report.metrics.performanceSummary.frontendIssues > 5 ? 'HIGH' : report.metrics.performanceSummary.frontendIssues > 2 ? 'MEDIUM' : 'LOW'} |

**Performance Impact**: ${
  report.metrics.performanceSummary.totalPerformanceIssues === 0 
    ? 'Excellent - No performance issues detected!'
    : report.metrics.performanceSummary.totalPerformanceIssues < 5
    ? 'Good - Minor performance optimizations possible'
    : report.metrics.performanceSummary.totalPerformanceIssues < 15
    ? 'Fair - Several performance improvements recommended'
    : 'Poor - Significant performance issues require immediate attention'
}

## Findings

${report.findings.map((f: string) => `- ${f}`).join('\n')}

## Risk Assessment

${report.risks.map((r: any) => `- **${r.level.toUpperCase()}**: ${r.description}`).join('\n')}

## Recommendations

${report.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

## Next Steps

1. Address high-risk issues immediately
2. Implement recommended process improvements
3. Schedule follow-up analysis in 30 days
4. Track improvement metrics

---
*Generated by lyra - AI-powered GitHub analysis tool*
`;
  }

  private async getUsername(): Promise<string> {
    // Try to get from git config or gh CLI
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync('gh api user -q .login');
      return stdout.trim();
    } catch {
      // Fallback: extract from first PR author
      const prs = await this.githubTools.searchPRs('is:pr', 1);
      if (prs.length > 0) {
        return prs[0].author.login;
      }
      throw new Error('Could not determine GitHub username');
    }
  }

  analyze = traceable(
    async (config: AnalysisConfig): Promise<void> => {
      const initialState = {
        messages: [new HumanMessage(`Analyze GitHub repository with focus: ${config.reviewFocus}`)],
        config,
        currentStep: 'started'
      };

      try {
        const finalState = await this.graph.invoke(initialState);
        if (finalState.error) {
          throw new Error(finalState.error);
        }
      } catch (error) {
        console.error('Analysis failed:', error);
        throw error;
      }
    },
    { name: 'github_analysis_workflow' }
  );
}