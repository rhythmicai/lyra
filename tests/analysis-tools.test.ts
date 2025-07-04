import { describe, test, expect, beforeEach } from '@jest/globals';
import { AnalysisTools } from '../src/tools/analysis-tools';
import { GitHubPR, PRMetrics } from '../src/types';

describe('AnalysisTools', () => {
  let analysisTools: AnalysisTools;

  beforeEach(() => {
    analysisTools = new AnalysisTools();
  });

  describe('selectPRs', () => {
    const mockPRs: GitHubPR[] = [
      {
        repository: { nameWithOwner: 'test/repo' },
        number: 1,
        state: 'OPEN',
        title: 'Test PR 1',
        body: 'Test body',
        createdAt: '2025-01-15T10:00:00Z',
        closedAt: null,
        author: { login: 'user1' },
        additions: 100,
        deletions: 50,
        url: 'https://github.com/test/repo/pull/1'
      },
      {
        repository: { nameWithOwner: 'test/repo' },
        number: 2,
        state: 'MERGED',
        title: 'Test PR 2',
        body: 'Test body',
        createdAt: '2025-01-14T10:00:00Z',
        closedAt: '2025-01-14T12:00:00Z',
        author: { login: 'user2' },
        additions: 200,
        deletions: 100,
        url: 'https://github.com/test/repo/pull/2'
      },
      {
        repository: { nameWithOwner: 'test/repo' },
        number: 3,
        state: 'CLOSED',
        title: 'Test PR 3',
        body: 'Test body',
        createdAt: '2025-01-13T10:00:00Z',
        closedAt: '2025-01-13T11:00:00Z',
        author: { login: 'user3' },
        additions: 50,
        deletions: 25,
        url: 'https://github.com/test/repo/pull/3'
      }
    ];

    test('should select last N PRs', () => {
      const result = analysisTools.selectPRs(mockPRs, 'last 2');
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[1].number).toBe(2);
    });

    test('should select largest PRs', () => {
      const result = analysisTools.selectPRs(mockPRs, 'largest 2');
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(2); // 300 total changes
      expect(result[1].number).toBe(1); // 150 total changes
    });

    test('should select open PRs', () => {
      const result = analysisTools.selectPRs(mockPRs, 'open');
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('OPEN');
    });

    test('should default to last 5 for unknown criteria', () => {
      const result = analysisTools.selectPRs(mockPRs, 'unknown');
      expect(result).toHaveLength(3); // All PRs since we have less than 5
    });
  });

  describe('analyzePRPatterns', () => {
    const mockPRs: GitHubPR[] = [
      {
        repository: { nameWithOwner: 'test/repo' },
        number: 1,
        state: 'MERGED',
        title: 'Add feature',
        body: '',
        createdAt: '2025-01-15T10:00:00Z',
        closedAt: '2025-01-15T12:00:00Z',
        author: { login: 'user1' },
        additions: 100,
        deletions: 50,
        url: 'https://github.com/test/repo/pull/1'
      }
    ];

    const mockMetrics: Record<string, PRMetrics> = {
      'test/repo#1': {
        testAdditions: 10,
        docAdditions: 5,
        securityPatternMatches: 2,
        totalAdditions: 100,
        totalDeletions: 50,
        filesChanged: 5
      }
    };

    test('should identify low test coverage', () => {
      const result = analysisTools.analyzePRPatterns(mockPRs, mockMetrics);
      
      expect(result.findings).toContain('Low test coverage: 10.0% average test-to-code ratio');
      expect(result.risks).toContainEqual({
        level: 'high',
        description: 'Insufficient test coverage increases regression risk'
      });
      expect(result.recommendations).toContain('Implement mandatory test coverage requirements');
    });

    test('should identify security concerns', () => {
      const result = analysisTools.analyzePRPatterns(mockPRs, mockMetrics);
      
      expect(result.findings).toContain('1 PRs contain potential security-sensitive changes');
      expect(result.recommendations).toContain('Review security-sensitive changes carefully');
    });
  });

  describe('generateAnalysisResult', () => {
    test('should generate comprehensive analysis result', () => {
      const mockPRs: GitHubPR[] = [
        {
          repository: { nameWithOwner: 'test/repo' },
          number: 1,
          state: 'MERGED',
          title: 'Test PR',
          body: '',
          createdAt: '2025-01-15T10:00:00Z',
          closedAt: '2025-01-15T12:00:00Z',
          author: { login: 'user1' },
          additions: 100,
          deletions: 50,
          url: 'https://github.com/test/repo/pull/1'
        }
      ];

      const mockMetrics: Record<string, PRMetrics> = {
        'test/repo#1': {
          testAdditions: 30,
          docAdditions: 10,
          securityPatternMatches: 0,
          totalAdditions: 100,
          totalDeletions: 50,
          filesChanged: 5
        }
      };

      const config = {
        reviewFocus: 'test coverage',
        prSelection: 'last 5'
      };

      const result = analysisTools.generateAnalysisResult(mockPRs, mockMetrics, config);

      expect(result.totalPRsAnalyzed).toBe(1);
      expect(result.reviewFocus).toBe('test coverage');
      expect(result.metrics.totalAdditions).toBe(100);
      expect(result.metrics.totalDeletions).toBe(50);
      expect(result.metrics.totalTestAdditions).toBe(30);
      expect(result.metrics.testToCodeRatio).toBe(30);
      expect(result.metrics.mergeRate).toBe(100);
      expect(result.metrics.averagePRSize).toBe(150);
    });

    test('should include time-based findings when activity data is provided', () => {
      const mockPRs: GitHubPR[] = [];
      const mockMetrics: Record<string, PRMetrics> = {};
      const config = {
        reviewFocus: 'test coverage',
        prSelection: 'last 5'
      };
      
      const mockActivityData = {
        summary: {
          last30Days: {
            totalPRs: 10,
            mergedPRs: 5,
            mergeRate: '50.0'
          },
          last90Days: {
            totalPRs: 30,
            mergedPRs: 25,
            mergeRate: '83.3'
          }
        }
      };

      const result = analysisTools.generateAnalysisResult(mockPRs, mockMetrics, config, mockActivityData);

      expect(result.findings).toContain('Merge rate declining: 50% (30d) vs 83.3% (90d)');
    });
  });
});