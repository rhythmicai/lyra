export interface GitHubPR {
  repository: {
    nameWithOwner: string;
  };
  number: number;
  state: string;
  title: string;
  body: string;
  createdAt: string;
  closedAt: string | null;
  mergedAt?: string | null;
  author: {
    login: string;
  };
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  labels?: Array<{ name: string }>;
  url: string;
}

export interface PRMetrics {
  testAdditions: number;
  docAdditions: number;
  securityPatternMatches: number;
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: number;
  // Performance metrics
  performanceIssues: PerformanceIssues;
}

export interface PerformanceIssues {
  // Database performance
  nPlusOneQueries: number;
  inefficientJoins: number;
  missingIndexSuggestions: number;
  queryOptimizationOpportunities: number;
  
  // Code performance
  algorithmicComplexityIssues: number;
  memoryLeakPatterns: number;
  inefficientLoops: number;
  resourceManagementIssues: number;
  
  // Runtime performance
  blockingOperations: number;
  asyncAwaitIssues: number;
  eventLoopBlocking: number;
  performanceAntiPatterns: number;
  
  // Frontend performance
  bundleSizeIssues: number;
  renderPerformanceIssues: number;
  memoryUsageIssues: number;
  networkOptimizationIssues: number;
}

export interface AnalysisConfig {
  reviewFocus: string;
  prSelection: string;
  username?: string;
  repoFilter?: string;
  languageFilter?: string;
  outputDir?: string;
}

export interface AnalysisResult {
  totalPRsAnalyzed: number;
  reviewFocus: string;
  selectionCriteria: string;
  analysisDate: string;
  metrics: {
    totalAdditions: number;
    totalDeletions: number;
    totalTestAdditions: number;
    totalDocAdditions: number;
    testToCodeRatio: number;
    mergeRate: number;
    averagePRSize: number;
    // Performance metrics summary
    performanceSummary: {
      totalPerformanceIssues: number;
      highRiskIssues: number;
      databaseIssues: number;
      codeQualityIssues: number;
      runtimeIssues: number;
      frontendIssues: number;
    };
  };
  findings: string[];
  recommendations: string[];
  risks: Array<{
    level: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

import { BaseMessage } from '@langchain/core/messages';

export interface AgentState {
  messages: BaseMessage[];
  config: AnalysisConfig;
  overviewData?: any;
  selectedPRs?: GitHubPR[];
  prAnalysis?: Record<string, PRMetrics>;
  finalReport?: AnalysisResult;
  currentStep: string;
  error?: string;
}