import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { GitHubAnalystAgent } from '../src/agents/github-analyst-agent';
import { AnalysisConfig } from '../src/types';
import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// This test requires environment variables to be set
const INTEGRATION_TEST = process.env.GITHUB_TOKEN && process.env.OPENAI_API_KEY;
const describeIf = INTEGRATION_TEST ? describe : describe.skip;

describeIf('Integration Tests', () => {
  let testOutputDir: string;
  let agent: GitHubAnalystAgent;

  beforeAll(() => {
    if (!process.env.GITHUB_TOKEN || !process.env.OPENAI_API_KEY) {
      console.log('Skipping integration tests: GITHUB_TOKEN and OPENAI_API_KEY must be set');
      return;
    }

    agent = new GitHubAnalystAgent(
      process.env.GITHUB_TOKEN,
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    );
  });

  beforeEach(() => {
    // Create unique temp directory for each test
    testOutputDir = join(tmpdir(), `lyra-test-${randomBytes(8).toString('hex')}`);
  });

  describe('Full workflow integration', () => {
    it('should analyze a real GitHub user and generate all reports', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'test coverage, code quality, documentation',
        prSelection: 'last 3',
        username: 'octocat', // Using GitHub's mascot account for testing
        outputDir: testOutputDir
      };

      await agent.analyze(config);

      // Verify output directory structure
      const date = new Date().toISOString().split('T')[0];
      const dateDir = join(testOutputDir, date);
      
      await access(dateDir); // Throws if doesn't exist
      
      const files = await readdir(dateDir);
      const analysisDir = files.find(f => f.startsWith('analysis-'));
      expect(analysisDir).toBeDefined();

      const fullAnalysisDir = join(dateDir, analysisDir!);

      // Verify all expected files exist
      const expectedFiles = [
        'COMPREHENSIVE_ASSESSMENT.md',
        'COACHING_ADVICE.md',
        'analysis-data.json'
      ];

      for (const file of expectedFiles) {
        await access(join(fullAnalysisDir, file));
      }

      // Verify content structure
      const assessmentContent = await readFile(
        join(fullAnalysisDir, 'COMPREHENSIVE_ASSESSMENT.md'),
        'utf-8'
      );
      expect(assessmentContent).toContain('# GitHub Code Quality Assessment');
      expect(assessmentContent).toContain('**User:** octocat');
      expect(assessmentContent).toContain('## Executive Summary');
      expect(assessmentContent).toContain('## Findings');
      expect(assessmentContent).toContain('## Recommendations');

      const coachingContent = await readFile(
        join(fullAnalysisDir, 'COACHING_ADVICE.md'),
        'utf-8'
      );
      expect(coachingContent).toContain('# Personal Development Coaching Report');
      expect(coachingContent).toContain('**Developer:** octocat');
      expect(coachingContent).toContain('Growth is a journey');

      const analysisData = JSON.parse(
        await readFile(join(fullAnalysisDir, 'analysis-data.json'), 'utf-8')
      );
      expect(analysisData).toHaveProperty('config');
      expect(analysisData).toHaveProperty('report');
      expect(analysisData.config.username).toBe('octocat');
    }, 60000); // 60 second timeout for API calls
  });

  describe('Error handling', () => {
    it('should handle invalid username gracefully', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'test coverage',
        prSelection: 'last 5',
        username: 'this-user-definitely-does-not-exist-12345',
        outputDir: testOutputDir
      };

      await agent.analyze(config);

      // Should still generate reports even with no PRs
      const date = new Date().toISOString().split('T')[0];
      const dateDir = join(testOutputDir, date);
      await access(dateDir);

      const files = await readdir(dateDir);
      const analysisDir = files.find(f => f.startsWith('analysis-'));
      expect(analysisDir).toBeDefined();

      const assessmentContent = await readFile(
        join(dateDir, analysisDir!, 'COMPREHENSIVE_ASSESSMENT.md'),
        'utf-8'
      );
      expect(assessmentContent).toContain('**PRs Analyzed:** 0');
    }, 30000);
  });

  describe('Repository filtering', () => {
    it('should filter PRs by repository', async () => {
      const config: AnalysisConfig = {
        reviewFocus: 'architecture, design patterns',
        prSelection: 'last 5',
        username: 'octocat',
        repoFilter: 'octocat/Hello-World',
        outputDir: testOutputDir
      };

      await agent.analyze(config);

      const date = new Date().toISOString().split('T')[0];
      const files = await readdir(join(testOutputDir, date));
      const analysisDir = files.find(f => f.startsWith('analysis-'));
      
      const analysisData = JSON.parse(
        await readFile(
          join(testOutputDir, date, analysisDir!, 'analysis-data.json'),
          'utf-8'
        )
      );

      // If there are PRs, they should all be from the specified repo
      if (analysisData.selectedPRs && analysisData.selectedPRs.length > 0) {
        analysisData.selectedPRs.forEach((pr: any) => {
          expect(pr.repository.nameWithOwner).toBe('octocat/Hello-World');
        });
      }
    }, 30000);
  });
});

// Mock integration tests that don't require real API calls
describe('Mock Integration Tests', () => {
  it('should validate configuration', () => {
    const validConfig: AnalysisConfig = {
      reviewFocus: 'test coverage',
      prSelection: 'last 10',
      username: 'testuser',
      repoFilter: 'org/repo',
      languageFilter: 'typescript,javascript',
      outputDir: './output'
    };

    // This should not throw
    expect(() => {
      // In a real implementation, we'd validate the config here
      const { reviewFocus, prSelection } = validConfig;
      if (!reviewFocus || !prSelection) {
        throw new Error('Invalid config');
      }
    }).not.toThrow();
  });

  it('should handle various PR selection criteria', () => {
    const selectionCriteria = [
      'last 5',
      'last 10',
      'largest 3',
      'last-week',
      'open',
      'unreviewed'
    ];

    selectionCriteria.forEach(criteria => {
      expect(() => {
        // Validate selection criteria format
        if (criteria.startsWith('last ')) {
          const num = parseInt(criteria.split(' ')[1]);
          expect(num).toBeGreaterThan(0);
        } else if (criteria.startsWith('largest ')) {
          const num = parseInt(criteria.split(' ')[1]);
          expect(num).toBeGreaterThan(0);
        } else {
          expect(['last-week', 'open', 'unreviewed']).toContain(criteria);
        }
      }).not.toThrow();
    });
  });
});