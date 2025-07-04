import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AnalysisConfig } from '../src/types';
import { readFile, access, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// This test uses real file system operations to verify output
describe.skip('Real File Output Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `lyra-real-test-${randomBytes(8).toString('hex')}`);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should write real files to disk', async () => {
    // Mock only the API calls, not file operations
    jest.doMock('../src/tools/github-tools', () => ({
      GitHubTools: jest.fn().mockImplementation(() => ({
        generateActivityReport: jest.fn().mockImplementation(async (username, outputDir) => {
          const date = new Date().toISOString().split('T')[0];
          const userDir = join(outputDir as string, username as string);
          const dateDir = join(userDir, date);
          const reportPath = join(dateDir, `${username}-activity-report.json`);
          
          // Use real fs operations
          const { mkdir, writeFile } = await import('fs/promises');
          await mkdir(dateDir, { recursive: true });
          await writeFile(reportPath, JSON.stringify({
            user: username,
            generatedAt: new Date().toISOString(),
            summary: {
              totalPRs: 10,
              mergeRate: 80,
              openPRs: 2,
              closedPRs: 3,
              mergedPRs: 5
            },
            repositories: [
              { repo: 'test/repo', count: 10 }
            ],
            monthlyActivity: [
              { month: '2025-01', count: 10 }
            ]
          }));
          
          return reportPath;
        }),
        searchPRs: jest.fn(() => Promise.resolve([
          {
            repository: { nameWithOwner: 'test/repo' },
            number: 1,
            state: 'MERGED',
            title: 'Test PR',
            body: 'Test body',
            createdAt: '2025-01-01T00:00:00Z',
            closedAt: '2025-01-01T12:00:00Z',
            author: { login: 'testuser' },
            url: 'https://github.com/test/repo/pull/1'
          }
        ])),
        getPRDetails: jest.fn(() => Promise.resolve({
          additions: 100,
          deletions: 50,
          changedFiles: 5
        })),
        getPRDiff: jest.fn(() => Promise.resolve('diff content')),
        analyzePRMetrics: jest.fn(() => Promise.resolve({
          testAdditions: 20,
          docAdditions: 10,
          securityPatternMatches: 0,
          totalAdditions: 100,
          totalDeletions: 50,
          filesChanged: 5
        }))
      }) as any)
    }));

    jest.doMock('../src/tools/analysis-tools', () => ({
      AnalysisTools: jest.fn().mockImplementation(() => ({
        selectPRs: jest.fn().mockImplementation((prs) => prs),
        generateAnalysisResult: jest.fn().mockReturnValue({
          totalPRsAnalyzed: 1,
          reviewFocus: 'test coverage',
          selectionCriteria: 'last 5',
          analysisDate: new Date().toISOString().split('T')[0],
          metrics: {
            totalAdditions: 100,
            totalDeletions: 50,
            totalTestAdditions: 20,
            totalDocAdditions: 10,
            testToCodeRatio: 20,
            mergeRate: 80,
            averagePRSize: 150
          },
          findings: ['Good test coverage'],
          recommendations: ['Keep up the good work'],
          risks: []
        })
      }))
    }));

    jest.doMock('../src/tools/coaching-tools', () => ({
      CoachingTools: jest.fn().mockImplementation(() => ({
        generateCoachingAdvice: jest.fn(() => Promise.resolve('Great job! Keep improving.')),
        formatCoachingReport: jest.fn().mockImplementation((advice, username) => 
          `# Personal Development Coaching Report\n\n**Developer:** ${username}\n\n${advice}`)
      }))
    }));

    jest.doMock('@langchain/openai', () => ({
      ChatOpenAI: jest.fn().mockImplementation(() => ({
        invoke: jest.fn(() => Promise.resolve({ 
          content: JSON.stringify({
            insights: ["Good practices", "Strong test coverage"],
            recommendations: ["Add more tests", "Consider documentation"],
            enhancedFindings: ["Excellent code quality"],
            actionableRecommendations: ["Keep up the good work"]
          })
        }))
      }))
    }));

    // Re-import to use mocked dependencies
    jest.resetModules();
    const { GitHubAnalystAgent: MockedAgent } = await import('../src/agents/github-analyst-agent');
    const testAgent = new MockedAgent('test-token', 'test-key');

    const config: AnalysisConfig = {
      reviewFocus: 'test coverage',
      prSelection: 'last 5',
      username: 'testuser',
      outputDir: tempDir
    };

    await testAgent.analyze(config);

    // Verify real files were created
    const date = new Date().toISOString().split('T')[0];
    const userDir = join(tempDir, 'testuser');
    const dateDir = join(userDir, date);
    
    // Check user and date directories exist
    await expect(access(userDir)).resolves.not.toThrow();
    await expect(access(dateDir)).resolves.not.toThrow();
    
    // Find analysis directory
    const files = await readdir(dateDir);
    const analysisDir = files.find(f => f.startsWith('analysis-'));
    expect(analysisDir).toBeDefined();

    const fullAnalysisDir = join(dateDir, analysisDir!);

    // Verify all expected files exist and have content with username prefix
    const expectedFiles = {
      'testuser-COMPREHENSIVE_ASSESSMENT.md': /# GitHub Code Quality Assessment/,
      'testuser-COACHING_ADVICE.md': /# Personal Development Coaching Report/,
      'testuser-analysis-data.json': /"config":/
    };

    for (const [filename, pattern] of Object.entries(expectedFiles)) {
      const filePath = join(fullAnalysisDir, filename);
      
      // File should exist
      await expect(access(filePath)).resolves.not.toThrow();
      
      // File should have content
      const content = await readFile(filePath, 'utf-8');
      expect(content).toMatch(pattern);
      expect(content.length).toBeGreaterThan(0);
    }

    // Verify activity report was created with username prefix
    const activityReportPath = join(dateDir, 'testuser-activity-report.json');
    await expect(access(activityReportPath)).resolves.not.toThrow();
    
    const activityReport = JSON.parse(await readFile(activityReportPath, 'utf-8'));
    expect(activityReport.user).toBe('testuser');
  });
});