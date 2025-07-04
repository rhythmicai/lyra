import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GitHubTools } from '../src/tools/github-tools';
import { mkdir, writeFile } from 'fs/promises';
import { exec } from 'child_process';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn()
}));

// Mock child_process with proper typing
jest.mock('child_process', () => ({
  exec: jest.fn(),
  promisify: () => jest.fn()
}));

// Mock the Octokit module
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    search: {
      issuesAndPullRequests: jest.fn()
    },
    pulls: {
      get: jest.fn(),
      listFiles: jest.fn()
    }
  }))
}));

describe('GitHubTools', () => {
  let githubTools: GitHubTools;
  let mockOctokit: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOctokit = {
      search: {
        issuesAndPullRequests: jest.fn()
      },
      pulls: {
        get: jest.fn(),
        listFiles: jest.fn()
      }
    };
    
    // The MockOctokit class will be instantiated by GitHubTools
    githubTools = new GitHubTools('test-token');
    
    // Get the instance that was created
    const octokitInstance = (githubTools as any).octokit;
    
    // Configure the mock methods
    octokitInstance.search.issuesAndPullRequests = mockOctokit.search.issuesAndPullRequests;
    octokitInstance.pulls.get = mockOctokit.pulls.get;
    octokitInstance.pulls.listFiles = mockOctokit.pulls.listFiles;
  });

  describe('searchPRs', () => {
    it('should search PRs using GitHub API when CLI is not available', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              number: 123,
              state: 'open',
              title: 'Test PR',
              body: 'Test body',
              created_at: '2025-01-01T00:00:00Z',
              closed_at: null,
              repository_url: 'https://api.github.com/repos/test/repo',
              user: { login: 'testuser' },
              labels: [{ name: 'bug' }],
              html_url: 'https://github.com/test/repo/pull/123'
            }
          ]
        }
      };

      mockOctokit.search.issuesAndPullRequests.mockResolvedValue(mockResponse as any);

      const result = await githubTools.searchPRs('author:testuser', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        number: 123,
        state: 'OPEN',
        title: 'Test PR',
        repository: { nameWithOwner: 'test/repo' }
      });
    });

    it('should detect merged PRs from pull_request.merged_at field', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              number: 123,
              state: 'closed',
              title: 'Merged PR',
              body: 'Test body',
              created_at: '2025-01-01T00:00:00Z',
              closed_at: '2025-01-02T00:00:00Z',
              pull_request: {
                merged_at: '2025-01-02T00:00:00Z'
              },
              repository_url: 'https://api.github.com/repos/test/repo',
              user: { login: 'testuser' },
              labels: [],
              html_url: 'https://github.com/test/repo/pull/123'
            }
          ]
        }
      };

      mockOctokit.search.issuesAndPullRequests.mockResolvedValue(mockResponse as any);

      const result = await githubTools.searchPRs('author:testuser', 10);

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('MERGED');
      expect(result[0].mergedAt).toBe('2025-01-02T00:00:00Z');
    });

    it.skip('should use gh CLI when available', async () => {
      const mockCliOutput = JSON.stringify([
        {
          repository: { nameWithOwner: 'test/repo' },
          number: 456,
          state: 'MERGED',
          title: 'CLI Test PR',
          body: 'CLI body',
          createdAt: '2025-01-02T00:00:00Z',
          closedAt: '2025-01-02T12:00:00Z',
          author: { login: 'cliuser' },
          labels: [],
          url: 'https://github.com/test/repo/pull/456'
        }
      ]);

      (exec as any).mockImplementation((cmd: any, cb: any) => {
        if (cmd.includes('--version')) {
          cb(null, { stdout: 'gh version 2.0.0' });
        } else {
          cb(null, { stdout: mockCliOutput });
        }
      });

      const result = await githubTools.searchPRs('author:cliuser', 5);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(456);
    });
  });

  describe('getPRDetails', () => {
    it('should get PR details using API', async () => {
      const mockPR = {
        data: {
          html_url: 'https://github.com/test/repo/pull/789',
          body: 'PR body',
          created_at: '2025-01-03T00:00:00Z',
          closed_at: null,
          additions: 100,
          deletions: 50,
          changed_files: 5,
          user: { login: 'testuser' },
          assignees: [],
          labels: [],
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
          draft: false
        }
      };

      mockOctokit.pulls.get.mockResolvedValue(mockPR as any);

      const result = await githubTools.getPRDetails('test', 'repo', 789);

      expect(result).toMatchObject({
        url: 'https://github.com/test/repo/pull/789',
        additions: 100,
        deletions: 50,
        changedFiles: 5
      });
    });
  });

  describe('analyzePRMetrics', () => {
    it.skip('should analyze PR metrics from diff', async () => {
      const mockDiff = `
diff --git a/src/test.js b/src/test.js
+function test() {
+  console.log('test');
+}
+
diff --git a/test/test.spec.js b/test/test.spec.js
+describe('test', () => {
+  it('should work', () => {
+    expect(true).toBe(true);
+  });
+});
+
diff --git a/README.md b/README.md
+# Test Project
+This is a test project
+
diff --git a/src/auth.js b/src/auth.js
+const password = 'secret';
+const token = generateToken();
`;

      const mockPRDetails = {
        additions: 10,
        deletions: 0,
        changedFiles: 4
      };

      const result = await githubTools.analyzePRMetrics(mockDiff, mockPRDetails);

      expect(result).toMatchObject({
        testAdditions: 4, // Lines in test.spec.js
        docAdditions: 2,  // Lines in README.md
        securityPatternMatches: 2, // password and token
        totalAdditions: 10,
        totalDeletions: 0,
        filesChanged: 4
      });
    });
  });

  describe('generateActivityReport', () => {
    it.skip('should generate activity report with username in path and time-based metrics', async () => {
      // Mock current date
      const mockDate = new Date('2025-01-15T00:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      const mockPRs = [
        {
          repository: { nameWithOwner: 'org/repo1' },
          number: 1,
          state: 'MERGED',
          title: 'PR 1',
          body: '',
          createdAt: '2025-01-10T00:00:00Z', // 5 days ago
          closedAt: '2025-01-10T12:00:00Z',
          author: { login: 'testuser' },
          url: 'https://github.com/org/repo1/pull/1'
        },
        {
          repository: { nameWithOwner: 'org/repo1' },
          number: 2,
          state: 'OPEN',
          title: 'PR 2',
          body: '',
          createdAt: '2024-11-01T00:00:00Z', // >30 days ago
          closedAt: null,
          author: { login: 'testuser' },
          url: 'https://github.com/org/repo1/pull/2'
        }
      ];

      jest.spyOn(githubTools, 'searchPRs').mockResolvedValue(mockPRs);
      (mkdir as any).mockImplementation(() => Promise.resolve());
      (writeFile as any).mockImplementation(() => Promise.resolve());

      const reportPath = await githubTools.generateActivityReport('testuser', './test-output');

      // Check mkdir was called with username in path
      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-output/testuser/2025-01-15'),
        { recursive: true }
      );
      
      // Check the report path includes username
      expect(reportPath).toContain('testuser');
      expect(reportPath).toContain('testuser-activity-report.json');

      const writeCall = (writeFile as any).mock.calls[0];
      const reportData = JSON.parse(writeCall[1] as string);
      
      expect(reportData).toMatchObject({
        user: 'testuser',
        summary: {
          totalPRs: 2,
          openPRs: 1,
          mergedPRs: 1,
          mergeRate: '50.0',
          last30Days: {
            totalPRs: 1,
            mergedPRs: 1,
            mergeRate: '100.0'
          },
          last90Days: {
            totalPRs: 1,
            mergedPRs: 1,
            mergeRate: '100.0'
          }
        }
      });
    });
  });
});