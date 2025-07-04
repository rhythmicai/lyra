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
  // Enhanced documentation metrics
  documentationMetrics?: {
    totalFunctions: number;
    documentedFunctions: number;
    totalClasses: number;
    documentedClasses: number;
    inlineCommentLines: number;
    blockCommentLines: number;
    todoCount: number;
    fixmeCount: number;
    commentToCodeRatio: number;
    hasReadme: boolean;
    readmeCompleteness: number;
    hasContributing: boolean;
    hasApiDocs: boolean;
    markdownFileCount: number;
    overallDocScore: number;
    codeDocScore: number;
    projectDocScore: number;
    undocumentedSymbols?: string[];
    suggestions?: string[];
  };
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
    // Enhanced documentation metrics
    documentationScore?: number;
    codeDocumentationScore?: number;
    projectDocumentationScore?: number;
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