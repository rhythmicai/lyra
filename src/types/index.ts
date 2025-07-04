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
  // Code Quality Metrics
  codeQualityMetrics?: CodeQualityMetrics;
}

export interface CodeQualityMetrics {
  // Complexity Metrics
  cyclomaticComplexity: ComplexityScore;
  cognitiveComplexity: ComplexityScore;
  nestingDepth: ComplexityScore;
  functionLength: ComplexityScore;
  
  // Maintainability Analysis
  codeDuplication: DuplicationScore;
  namingConventions: ConventionScore;
  solidPrinciples: SolidScore;
  
  // Code Smells and Anti-patterns
  codeSmells: CodeSmell[];
  antiPatterns: AntiPattern[];
  
  // Best Practices
  languageIdioms: LanguageIdiomScore;
  designPatterns: DesignPatternUsage[];
}

export interface ComplexityScore {
  average: number;
  maximum: number;
  violationsCount: number;
  files: Array<{
    path: string;
    score: number;
    functions?: Array<{
      name: string;
      line: number;
      score: number;
    }>;
  }>;
}

export interface DuplicationScore {
  percentage: number;
  linesCount: number;
  blocksCount: number;
  duplicatedBlocks: Array<{
    lines: number;
    occurrences: number;
    files: string[];
  }>;
}

export interface ConventionScore {
  overall: number;
  categories: {
    variables: number;
    functions: number;
    classes: number;
    files: number;
  };
  violations: Array<{
    type: string;
    file: string;
    line: number;
    message: string;
  }>;
}

export interface SolidScore {
  overall: number;
  principles: {
    singleResponsibility: number;
    openClosed: number;
    liskovSubstitution: number;
    interfaceSegregation: number;
    dependencyInversion: number;
  };
  violations: Array<{
    principle: string;
    file: string;
    line: number;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export interface CodeSmell {
  type: string;
  file: string;
  line: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface AntiPattern {
  type: string;
  file: string;
  lines: number[];
  description: string;
  impact: 'high' | 'medium' | 'low';
  refactoringGuide: string;
}

export interface LanguageIdiomScore {
  overall: number;
  language: string;
  idiomUsage: Array<{
    idiom: string;
    usage: 'good' | 'poor' | 'missing';
    file: string;
    line?: number;
    suggestion: string;
  }>;
}

export interface DesignPatternUsage {
  pattern: string;
  usage: 'correct' | 'incorrect' | 'potential';
  file: string;
  lines: number[];
  description: string;
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
    // Code Quality Aggregated Metrics
    averageComplexity?: number;
    codeQualityScore?: number;
    maintainabilityIndex?: number;
  };
  findings: string[];
  recommendations: string[];
  risks: Array<{
    level: 'high' | 'medium' | 'low';
    description: string;
  }>;
  // Code Quality Analysis Results
  codeQuality?: {
    overallScore: number;
    complexityAnalysis: ComplexityAnalysisSummary;
    maintainabilityAnalysis: MaintainabilityAnalysisSummary;
    bestPracticesAnalysis: BestPracticesAnalysisSummary;
  };
}

export interface ComplexityAnalysisSummary {
  averageCyclomaticComplexity: number;
  averageCognitiveComplexity: number;
  maxNestingDepth: number;
  averageFunctionLength: number;
  highComplexityFiles: string[];
  recommendations: string[];
}

export interface MaintainabilityAnalysisSummary {
  duplicationPercentage: number;
  namingConventionScore: number;
  solidPrinciplesScore: number;
  codeSmellsCount: number;
  criticalIssues: string[];
  recommendations: string[];
}

export interface BestPracticesAnalysisSummary {
  languageIdiomScore: number;
  designPatternUsage: number;
  antiPatternsCount: number;
  bestPracticeViolations: string[];
  recommendations: string[];
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