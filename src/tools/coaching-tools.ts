import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { AnalysisResult } from '../types/index.js';
import { traceable } from 'langsmith/traceable';

export class CoachingTools {
  private model: ChatOpenAI;

  constructor(openaiApiKey: string, modelName: string = 'gpt-4-turbo-preview') {
    this.model = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName,
      temperature: 0.7, // Slightly higher for more creative coaching advice
    });
  }

  generateCoachingAdvice = traceable(async (
    activityReport: any,
    analysisResult: AnalysisResult,
    username: string
  ): Promise<string> => {
    const prompt = `You are a senior software engineer with 15+ years of experience, known for mentoring and developing talent. 
You're reviewing a peer's GitHub activity and code quality metrics to provide constructive, actionable coaching advice.

Developer: ${username}
Analysis Period: ${activityReport.generatedAt ? new Date(activityReport.generatedAt).toLocaleDateString() : 'Recent'}

ACTIVITY SUMMARY:
- Total PRs: ${activityReport.summary?.totalPRs || 0}
- Merge Rate: ${activityReport.summary?.mergeRate || 0}%
- Open PRs: ${activityReport.summary?.openPRs || 0}
- Closed PRs: ${activityReport.summary?.closedPRs || 0}
- Merged PRs: ${activityReport.summary?.mergedPRs || 0}

TOP REPOSITORIES:
${activityReport.repositories?.slice(0, 5).map((r: any) => `- ${r.repo}: ${r.count} PRs`).join('\n') || 'No repository data'}

MONTHLY ACTIVITY TREND:
${activityReport.monthlyActivity?.slice(0, 3).map((m: any) => `- ${m.month}: ${m.count} PRs`).join('\n') || 'No monthly data'}

CODE QUALITY METRICS:
- Test Coverage Ratio: ${analysisResult.metrics.testToCodeRatio.toFixed(1)}%
- Documentation Updates: ${analysisResult.metrics.totalDocAdditions} lines
- Average PR Size: ${analysisResult.metrics.averagePRSize.toFixed(0)} changes
- Total Code Changes: +${analysisResult.metrics.totalAdditions} / -${analysisResult.metrics.totalDeletions}

KEY FINDINGS:
${analysisResult.findings.join('\n')}

IDENTIFIED RISKS:
${analysisResult.risks.map(r => `- ${r.level.toUpperCase()}: ${r.description}`).join('\n')}

Based on this data, write a personal, encouraging coaching letter to ${username}. Structure it as follows:

1. **Opening**: Warm greeting acknowledging their efforts and contributions
2. **Strengths Recognition**: Highlight 2-3 specific strengths based on the data
3. **Growth Opportunities**: Identify 3-4 specific areas for improvement with concrete suggestions
4. **Skill Development Plan**: Provide a prioritized 30/60/90 day plan for skill improvement
5. **Resources & Next Steps**: Suggest specific resources, practices, or habits to adopt
6. **Closing**: Encouraging message about their potential and growth trajectory

Write in a supportive, peer-to-peer tone. Be specific with examples from their data, but focus on growth and improvement rather than criticism. 
Include practical tips they can implement immediately. Make it personal and actionable.`;

    const response = await this.model.invoke([new HumanMessage(prompt)]);
    
    return response.content as string;
  }, { name: 'coaching_generate_advice' });

  formatCoachingReport(coachingAdvice: string, username: string): string {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Personal Development Coaching Report

**Developer:** ${username}  
**Date:** ${date}  
**Prepared by:** Senior Engineering Mentor

---

${coachingAdvice}

---

## Remember

Growth is a journey, not a destination. Every PR, every code review, and every refactoring is an opportunity to improve. The fact that you're seeking feedback shows you're already on the right path.

Keep coding, keep learning, and keep pushing yourself to new heights! 🚀

*This coaching report was generated based on your GitHub activity analysis. Use it as a guide for continuous improvement.*`;
  }
}