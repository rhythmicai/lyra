import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GitHubAnalystAgent } from '../src/agents/github-analyst-agent';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { AnalysisConfig } from '../src/types';

// Mock all dependencies
jest.mock('../src/tools/github-tools');
jest.mock('../src/tools/analysis-tools');
jest.mock('../src/tools/coaching-tools');
jest.mock('@langchain/openai');
jest.mock('child_process');

describe.skip('File Output Tests', () => {
  let tempDir: string;
  let mockWriteFile: jest.Mock;
  let mockMkdir: jest.Mock;
  let mockReadFile: jest.Mock;
  let writeFileContents: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create temp directory for testing
    tempDir = join(tmpdir(), `lyra-test-${randomBytes(4).toString('hex')}`);
    
    // Track file writes
    writeFileContents = new Map();
    
    // Mock file system operations
    mockWriteFile = jest.fn().mockImplementation((path: any, content: any) => {
      writeFileContents.set(path, content);
      return Promise.resolve();
    }) as any;
    
    mockMkdir = jest.fn(() => Promise.resolve()) as any;
    
    mockReadFile = jest.fn().mockImplementation((path: any) => {
      if (path.includes('activity-report.json')) {
        return Promise.resolve(JSON.stringify({
          user: 'testuser',
          summary: { totalPRs: 10, mergeRate: 80 }
        }));
      }
      return Promise.resolve(writeFileContents.get(path) || '{}');
    }) as any;
    
    (writeFile as any) = mockWriteFile;
    (mkdir as any) = mockMkdir;
    (readFile as any) = mockReadFile;
  });

  it('should create correct directory structure', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'test coverage',
      prSelection: 'last 5',
      outputDir: tempDir
    };

    await agent.analyze(config);

    // Check directory creation
    expect(mockMkdir).toHaveBeenCalled();
    const mkdirCalls = mockMkdir.mock.calls;
    
    // Should create dated directory structure
    const dirPath = mkdirCalls[0][0] as string;
    expect(dirPath).toContain(tempDir);
    expect(dirPath).toMatch(/\d{4}-\d{2}-\d{2}\/analysis-/);
  });

  it('should write all required output files', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'test coverage',
      prSelection: 'last 5',
      username: 'testuser',
      outputDir: tempDir
    };

    await agent.analyze(config);

    // Check that all files were written
    const writtenFiles = Array.from(writeFileContents.keys());
    
    // Should have activity report
    const activityReport = writtenFiles.find(f => f.includes('activity-report.json'));
    expect(activityReport).toBeDefined();
    
    // Should have comprehensive assessment
    const assessment = writtenFiles.find(f => f.includes('COMPREHENSIVE_ASSESSMENT.md'));
    expect(assessment).toBeDefined();
    
    // Should have coaching advice
    const coaching = writtenFiles.find(f => f.includes('COACHING_ADVICE.md'));
    expect(coaching).toBeDefined();
    
    // Should have analysis data
    const analysisData = writtenFiles.find(f => f.includes('analysis-data.json'));
    expect(analysisData).toBeDefined();
  });

  it('should include correct content in assessment report', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'architecture, testing',
      prSelection: 'last 10',
      username: 'testuser',
      outputDir: tempDir
    };

    await agent.analyze(config);

    // Find assessment content
    const assessmentPath = Array.from(writeFileContents.keys())
      .find(f => f.includes('COMPREHENSIVE_ASSESSMENT.md'));
    const assessmentContent = writeFileContents.get(assessmentPath!);

    expect(assessmentContent).toBeDefined();
    expect(assessmentContent).toContain('# GitHub Code Quality Assessment');
    expect(assessmentContent).toContain('**User:** testuser');
    expect(assessmentContent).toContain('**Review Focus:** architecture, testing');
    expect(assessmentContent).toContain('## Executive Summary');
    expect(assessmentContent).toContain('## Findings');
    expect(assessmentContent).toContain('## Risk Assessment');
    expect(assessmentContent).toContain('## Recommendations');
  });

  it('should include personalized content in coaching report', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'test coverage',
      prSelection: 'last 5',
      username: 'developer123',
      outputDir: tempDir
    };

    await agent.analyze(config);

    // Find coaching content
    const coachingPath = Array.from(writeFileContents.keys())
      .find(f => f.includes('COACHING_ADVICE.md'));
    const coachingContent = writeFileContents.get(coachingPath!);

    expect(coachingContent).toBeDefined();
    expect(coachingContent).toContain('# Personal Development Coaching Report');
    expect(coachingContent).toContain('**Developer:** developer123');
    expect(coachingContent).toContain('Growth is a journey');
  });

  it('should save valid JSON in analysis-data.json', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'security',
      prSelection: 'open',
      outputDir: tempDir
    };

    await agent.analyze(config);

    // Find and parse analysis data
    const dataPath = Array.from(writeFileContents.keys())
      .find(f => f.includes('analysis-data.json'));
    const dataContent = writeFileContents.get(dataPath!);

    expect(dataContent).toBeDefined();
    
    // Should be valid JSON
    const parsed = JSON.parse(dataContent!);
    expect(parsed).toHaveProperty('config');
    expect(parsed.config).toMatchObject({
      reviewFocus: 'security',
      prSelection: 'open'
    });
    expect(parsed).toHaveProperty('report');
    expect(parsed).toHaveProperty('selectedPRs');
    expect(parsed).toHaveProperty('metrics');
  });

  it('should use correct date format in directory names', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'test',
      prSelection: 'last 1',
      outputDir: tempDir
    };

    await agent.analyze(config);

    const dirPath = mockMkdir.mock.calls[0][0] as string;
    const dateMatch = dirPath.match(/(\d{4}-\d{2}-\d{2})/);
    
    expect(dateMatch).toBeDefined();
    const dateStr = dateMatch![1];
    const date = new Date(dateStr);
    
    // Should be valid date
    expect(date.toString()).not.toBe('Invalid Date');
    
    // Should be today's date
    const today = new Date().toISOString().split('T')[0];
    expect(dateStr).toBe(today);
  });

  it('should handle missing username gracefully', async () => {
    const agent = new GitHubAnalystAgent('test-token', 'test-key');
    const config: AnalysisConfig = {
      reviewFocus: 'test',
      prSelection: 'last 1',
      outputDir: tempDir
      // No username provided
    };

    // Mock exec to return authenticated user
    const mockExec = require('child_process').exec;
    mockExec.mockImplementation((cmd: string, cb: any) => {
      if (cmd.includes('gh api user')) {
        cb(null, { stdout: 'authenticated-user\n' });
      } else {
        cb(new Error('Command not found'), null);
      }
    });

    await agent.analyze(config);

    // Should still create all files
    const writtenFiles = Array.from(writeFileContents.keys());
    expect(writtenFiles.length).toBeGreaterThanOrEqual(3); // At least 3 main files
    
    // Should use authenticated user in reports
    const assessmentPath = writtenFiles.find(f => f.includes('COMPREHENSIVE_ASSESSMENT.md'));
    const assessmentContent = writeFileContents.get(assessmentPath!);
    expect(assessmentContent).toContain('authenticated-user');
  });
});