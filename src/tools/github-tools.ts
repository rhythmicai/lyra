import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GitHubPR, PRMetrics } from '../types/index.js';
import { traceable } from 'langsmith/traceable';

const execAsync = promisify(exec);

export class GitHubTools {
  private octokit: Octokit;
  private ghCliAvailable: boolean = false;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.checkGHCli();
  }

  private async checkGHCli() {
    try {
      await execAsync('gh --version');
      this.ghCliAvailable = true;
    } catch {
      console.warn('GitHub CLI not available, using API only');
    }
  }

  searchPRs = traceable(async (query: string, limit: number = 100): Promise<GitHubPR[]> => {
    if (this.ghCliAvailable) {
      try {
        const { stdout } = await execAsync(
          `gh search prs "${query}" --limit=${limit} --json repository,number,state,title,body,createdAt,closedAt,author,labels,url`
        );
        const prs = JSON.parse(stdout);
        
        // For CLI results, we need to check each PR individually to get merge status
        const enrichedPRs = await Promise.all(
          prs.map(async (pr: any) => {
            try {
              const [owner, repo] = pr.repository.nameWithOwner.split('/');
              const { stdout: prDetails } = await execAsync(
                `gh pr view ${pr.number} --repo ${owner}/${repo} --json state,mergedAt`
              );
              const details = JSON.parse(prDetails);
              
              return {
                ...pr,
                state: details.mergedAt ? 'MERGED' : pr.state.toUpperCase(),
                mergedAt: details.mergedAt || null
              };
            } catch (error) {
              // If we can't get details, just use the original state
              return {
                ...pr,
                state: pr.state.toUpperCase(),
                mergedAt: null
              };
            }
          })
        );
        
        return enrichedPRs;
      } catch (error) {
        console.warn('Falling back to API:', error);
      }
    }

    // Fallback to API
    const response = await this.octokit.rest.search.issuesAndPullRequests({
      q: `${query} is:pr`,
      per_page: Math.min(limit, 100),
      sort: 'created',
      order: 'desc'
    });

    return response.data.items.map(item => ({
      repository: {
        nameWithOwner: item.repository_url.replace('https://api.github.com/repos/', '')
      },
      number: item.number,
      state: (item as any).pull_request?.merged_at ? 'MERGED' : item.state.toUpperCase(),
      title: item.title,
      body: item.body || '',
      createdAt: item.created_at,
      closedAt: item.closed_at,
      mergedAt: (item as any).pull_request?.merged_at || null,
      author: {
        login: item.user?.login || 'unknown'
      },
      labels: item.labels.map(l => ({ name: typeof l === 'string' ? l : l.name || '' })),
      url: item.html_url
    }));
  }, { name: 'github_search_prs' });

  getPRDetails = traceable(async (owner: string, repo: string, prNumber: number): Promise<any> => {
    if (this.ghCliAvailable) {
      try {
        const { stdout } = await execAsync(
          `gh pr view ${prNumber} --repo ${owner}/${repo} --json url,body,createdAt,closedAt,additions,deletions,changedFiles,author,assignees,labels,headRefName,baseRefName,isDraft`
        );
        return JSON.parse(stdout);
      } catch (error) {
        console.warn('Falling back to API:', error);
      }
    }

    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    return {
      url: data.html_url,
      body: data.body || '',
      createdAt: data.created_at,
      closedAt: data.closed_at,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
      author: data.user,
      assignees: data.assignees,
      labels: data.labels,
      headRefName: data.head.ref,
      baseRefName: data.base.ref,
      isDraft: data.draft
    };
  }, { name: 'github_get_pr_details' });

  getPRDiff = traceable(async (owner: string, repo: string, prNumber: number): Promise<string> => {
    if (this.ghCliAvailable) {
      try {
        const { stdout } = await execAsync(
          `gh pr diff ${prNumber} --repo ${owner}/${repo}`
        );
        return stdout;
      } catch (error) {
        console.warn('Falling back to API:', error);
      }
    }

    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff'
      }
    });

    return data as unknown as string;
  }, { name: 'github_get_pr_diff' });

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100
    });

    return data.map(file => ({
      path: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      changeType: file.status
    }));
  }

  analyzePRMetrics = traceable(async (diff: string, prDetails: any): Promise<PRMetrics> => {
    const lines = diff.split('\n');
    
    // Count test additions
    const testAdditions = lines.filter(line => 
      line.startsWith('+') && 
      (line.match(/test|Test|TEST|\.test\.|_test\.|\.spec\./i) || false)
    ).length;

    // Count documentation additions
    const docAdditions = lines.filter(line =>
      line.startsWith('+') &&
      (line.match(/README|\.md|\/\*\*|\/\/\/|#.*TODO|#.*FIXME/i) || false)
    ).length;

    // Count security patterns
    const securityPatternMatches = lines.filter(line =>
      line.startsWith('+') &&
      (line.match(/password|secret|token|api_key|private_key|auth/i) || false)
    ).length;

    return {
      testAdditions,
      docAdditions,
      securityPatternMatches,
      totalAdditions: prDetails.additions || 0,
      totalDeletions: prDetails.deletions || 0,
      filesChanged: prDetails.changedFiles || 0
    };
  }, { name: 'github_analyze_pr_metrics' });

  async generateActivityReport(username: string, outputDir: string): Promise<string> {
    const date = new Date().toISOString().split('T')[0];
    const reportDir = join(outputDir, username, date);
    await mkdir(reportDir, { recursive: true });

    // Search for PRs (get more for better time-based analysis)
    const prs = await this.searchPRs(`author:${username}`, 1000);
    
    // Calculate time-based filters
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const prsLast30Days = prs.filter(pr => new Date(pr.createdAt) > thirtyDaysAgo);
    const prsLast90Days = prs.filter(pr => new Date(pr.createdAt) > ninetyDaysAgo);
    
    // Calculate statistics
    const openPRs = prs.filter(pr => pr.state === 'OPEN').length;
    const closedPRs = prs.filter(pr => pr.state === 'CLOSED').length;
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED').length;
    
    // Calculate 30-day and 90-day stats
    const merged30Days = prsLast30Days.filter(pr => pr.state === 'MERGED').length;
    const merged90Days = prsLast90Days.filter(pr => pr.state === 'MERGED').length;
    
    // Group by repository
    const repoStats = prs.reduce((acc, pr) => {
      const repo = pr.repository.nameWithOwner;
      acc[repo] = (acc[repo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly activity
    const monthlyActivity = prs.reduce((acc, pr) => {
      const month = pr.createdAt.substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const report = {
      user: username,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPRs: prs.length,
        openPRs,
        closedPRs,
        mergedPRs,
        mergeRate: prs.length > 0 ? (mergedPRs / prs.length * 100).toFixed(1) : '0',
        last30Days: {
          totalPRs: prsLast30Days.length,
          mergedPRs: merged30Days,
          mergeRate: prsLast30Days.length > 0 ? (merged30Days / prsLast30Days.length * 100).toFixed(1) : '0'
        },
        last90Days: {
          totalPRs: prsLast90Days.length,
          mergedPRs: merged90Days,
          mergeRate: prsLast90Days.length > 0 ? (merged90Days / prsLast90Days.length * 100).toFixed(1) : '0'
        }
      },
      repositories: Object.entries(repoStats)
        .sort(([, a], [, b]) => b - a)
        .map(([repo, count]) => ({ repo, count })),
      monthlyActivity: Object.entries(monthlyActivity)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, count]) => ({ month, count })),
      recentPRs: prs.slice(0, 30).map(pr => ({
        repo: pr.repository.nameWithOwner,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        createdAt: pr.createdAt
      }))
    };

    const reportPath = join(reportDir, `${username}-activity-report.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }
}