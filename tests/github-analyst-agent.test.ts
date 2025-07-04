import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GitHubAnalystAgent } from '../src/agents/github-analyst-agent';
import { GitHubTools } from '../src/tools/github-tools';
import { AnalysisTools } from '../src/tools/analysis-tools';
import { CoachingTools } from '../src/tools/coaching-tools';
import { ChatOpenAI } from '@langchain/openai';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { AnalysisConfig } from '../src/types';

jest.mock('../src/tools/github-tools');
jest.mock('../src/tools/analysis-tools');
jest.mock('../src/tools/coaching-tools');
jest.mock('@langchain/openai');
jest.mock('fs/promises');
jest.mock('child_process');

describe.skip('GitHubAnalystAgent', () => {
  let agent: GitHubAnalystAgent;
  let mockGitHubTools: jest.Mocked<GitHubTools>;
  let mockAnalysisTools: jest.Mocked<AnalysisTools>;
  let mockCoachingTools: jest.Mocked<CoachingTools>;
  let mockChatModel: jest.Mocked<ChatOpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system operations
    (mkdir as any).mockResolvedValue(undefined as any);
    (writeFile as any).mockResolvedValue(undefined as any);
    (readFile as any).mockResolvedValue('{}' as any);

    // Mock tools
    mockGitHubTools = {
      generateActivityReport: jest.fn(() => Promise.resolve('/path/to/report.json')),
      searchPRs: jest.fn(() => Promise.resolve([])),
      getPRDetails: jest.fn(() => Promise.resolve({})),
      getPRDiff: jest.fn(() => Promise.resolve('')),
      analyzePRMetrics: jest.fn(() => Promise.resolve({
        testAdditions: 10,
        docAdditions: 5,
        securityPatternMatches: 0,
        totalAdditions: 100,
        totalDeletions: 50,
        filesChanged: 5
      }))
    } as any;

    mockAnalysisTools = {
      selectPRs: jest.fn().mockReturnValue([]),
      generateAnalysisResult: jest.fn().mockReturnValue({
        totalPRsAnalyzed: 5,
        reviewFocus: 'test coverage',
        selectionCriteria: 'last 5',
        analysisDate: '2025-01-15',
        metrics: {
          totalAdditions: 500,
          totalDeletions: 250,
          totalTestAdditions: 100,
          totalDocAdditions: 50,
          testToCodeRatio: 20,
          mergeRate: 80,
          averagePRSize: 150
        },
        findings: ['Good test coverage'],
        recommendations: ['Keep up the good work'],
        risks: []
      })
    } as any;

    mockCoachingTools = {
      generateCoachingAdvice: jest.fn(() => Promise.resolve('Great job!')),
      formatCoachingReport: jest.fn().mockReturnValue('# Coaching Report\n\nGreat job!')
    } as any;

    mockChatModel = {
      invoke: jest.fn(() => Promise.resolve({ content: '{"insights": [], "recommendations": []}' }))
    } as any;

    (GitHubTools as jest.MockedClass<typeof GitHubTools>).mockImplementation(() => mockGitHubTools);
    (AnalysisTools as jest.MockedClass<typeof AnalysisTools>).mockImplementation(() => mockAnalysisTools);
    (CoachingTools as jest.MockedClass<typeof CoachingTools>).mockImplementation(() => mockCoachingTools);
    (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(() => mockChatModel);

    agent = new GitHubAnalystAgent('github-token', 'openai-key');
  });

  describe('analyze', () => {
    it('should complete full analysis workflow', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'test coverage, code quality',
        prSelection: 'last 10',
        username: 'testuser',
        outputDir: './test-output'
      };

      const mockPRs = [
        {
          repository: { nameWithOwner: 'test/repo' },
          number: 1,
          state: 'MERGED',
          title: 'Test PR',
          body: '',
          createdAt: '2025-01-01T00:00:00Z',
          closedAt: '2025-01-01T12:00:00Z',
          author: { login: 'testuser' },
          url: 'https://github.com/test/repo/pull/1'
        }
      ];

      mockGitHubTools.searchPRs.mockResolvedValue(mockPRs);
      mockAnalysisTools.selectPRs.mockReturnValue(mockPRs);
      
      // Mock reading activity report
      (readFile as any).mockResolvedValue(JSON.stringify({
        user: 'testuser',
        summary: { totalPRs: 10, mergeRate: 80 }
      }) as any);

      await agent.analyze(config);

      // Verify workflow steps executed
      expect(mockGitHubTools.generateActivityReport).toHaveBeenCalledWith(
        'testuser',
        './test-output'
      );
      expect(mockGitHubTools.searchPRs).toHaveBeenCalledWith(
        'author:testuser',
        200
      );
      expect(mockAnalysisTools.selectPRs).toHaveBeenCalledWith(
        mockPRs,
        'last 10'
      );
      expect(mockAnalysisTools.generateAnalysisResult).toHaveBeenCalled();
      expect(mockCoachingTools.generateCoachingAdvice).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledTimes(3); // assessment, coaching, data
    });

    it('should handle errors gracefully', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'test coverage',
        prSelection: 'last 5'
      };

      mockGitHubTools.generateActivityReport.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(agent.analyze(config)).rejects.toThrow();
    });

    it('should use authenticated user when username not provided', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'test coverage',
        prSelection: 'last 5'
      };

      // Mock getUsername to return authenticated user
      const mockExec = require('child_process').exec;
      mockExec.mockImplementation((_cmd: string, cb: any) => {
        cb(null, { stdout: 'authenticated-user\n' });
      });

      await agent.analyze(config);

      expect(mockGitHubTools.generateActivityReport).toHaveBeenCalledWith(
        'authenticated-user',
        './insights'
      );
    });
  });

  describe('workflow nodes', () => {
    it('should handle PR analysis with metrics', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'security',
        prSelection: 'last 5',
        username: 'testuser'
      };

      const mockPRs = [
        {
          repository: { nameWithOwner: 'test/repo' },
          number: 1,
          state: 'OPEN',
          title: 'Security Update',
          body: '',
          createdAt: '2025-01-15T00:00:00Z',
          closedAt: null,
          author: { login: 'testuser' },
          additions: 200,
          deletions: 100,
          url: 'https://github.com/test/repo/pull/1'
        }
      ];

      mockGitHubTools.searchPRs.mockResolvedValue(mockPRs);
      mockAnalysisTools.selectPRs.mockReturnValue(mockPRs);

      mockGitHubTools.getPRDiff.mockResolvedValue(`
+const password = 'hardcoded';
+const token = process.env.API_TOKEN;
      `);

      mockGitHubTools.analyzePRMetrics.mockResolvedValue({
        testAdditions: 0,
        docAdditions: 0,
        securityPatternMatches: 2,
        totalAdditions: 200,
        totalDeletions: 100,
        filesChanged: 3
      });

      await agent.analyze(config);

      expect(mockGitHubTools.getPRDiff).toHaveBeenCalledWith('test', 'repo', 1);
      expect(mockGitHubTools.analyzePRMetrics).toHaveBeenCalled();
    });

    it('should generate AI insights in report generation', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'architecture',
        prSelection: 'largest 3'
      };

      mockChatModel.invoke.mockResolvedValue({
        content: JSON.stringify({
          insights: [
            'Good separation of concerns',
            'Consider implementing dependency injection'
          ],
          recommendations: [
            'Add integration tests',
            'Document architectural decisions'
          ]
        })
      } as any);

      await agent.analyze(config);

      expect(mockChatModel.invoke).toHaveBeenCalled();
      const generatedReport = mockAnalysisTools.generateAnalysisResult.mock.results[0].value as any;
      expect(generatedReport.findings).toContain('Good separation of concerns');
      expect(generatedReport.recommendations).toContain('Add integration tests');
    });
  });
});