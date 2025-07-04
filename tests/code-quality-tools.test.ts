import { CodeQualityTools } from '../src/tools/code-quality-tools';
import { AnalysisTools } from '../src/tools/analysis-tools';
import { PRMetrics } from '../src/types/index';

describe('CodeQualityTools', () => {
  let codeQualityTools: CodeQualityTools;
  let analysisTools: AnalysisTools;

  beforeEach(() => {
    codeQualityTools = new CodeQualityTools();
    analysisTools = new AnalysisTools();
  });

  describe('analyzeCodeQuality', () => {
    it('should analyze basic code quality metrics from diff content', () => {
      const mockDiffContent = `
diff --git a/src/example.js b/src/example.js
index 1234567..abcdefg 100644
--- a/src/example.js
+++ b/src/example.js
@@ -1,3 +1,10 @@
+function complexFunction(a, b, c, d, e) {
+  if (a > 0) {
+    if (b > 0) {
+      if (c > 0) {
+        return a + b + c + d + e;
+      }
+    }
+  }
+  return 0;
+}
`;

      const result = codeQualityTools.analyzeCodeQuality(mockDiffContent);

      expect(result).toBeDefined();
      expect(result.cyclomaticComplexity).toBeDefined();
      expect(result.cognitiveComplexity).toBeDefined();
      expect(result.nestingDepth).toBeDefined();
      expect(result.functionLength).toBeDefined();
      expect(result.codeDuplication).toBeDefined();
      expect(result.namingConventions).toBeDefined();
      expect(result.solidPrinciples).toBeDefined();
      expect(result.codeSmells).toBeDefined();
      expect(result.antiPatterns).toBeDefined();
      expect(result.languageIdioms).toBeDefined();
      expect(result.designPatterns).toBeDefined();
    });

    it('should handle empty diff content gracefully', () => {
      const result = codeQualityTools.analyzeCodeQuality('');

      expect(result).toBeDefined();
      expect(result.cyclomaticComplexity.average).toBe(0);
      expect(result.cognitiveComplexity.average).toBe(0);
      expect(result.nestingDepth.average).toBe(0);
      expect(result.functionLength.average).toBe(0);
    });

    it('should detect complexity in nested control structures', () => {
      const complexDiff = `
diff --git a/src/complex.js b/src/complex.js
+function veryComplexFunction(x) {
+  for (let i = 0; i < 10; i++) {
+    if (x > 0) {
+      while (x > 0) {
+        if (x % 2 === 0) {
+          x = x / 2;
+        } else {
+          x = x - 1;
+        }
+      }
+    }
+  }
+  return x;
+}
`;

      const result = codeQualityTools.analyzeCodeQuality(complexDiff);

      expect(result.cyclomaticComplexity.average).toBeGreaterThan(1);
      expect(result.nestingDepth.average).toBeGreaterThan(1);
    });
  });

  describe('AnalysisTools with Code Quality', () => {
    it('should generate code quality analysis from metrics', () => {
      const mockMetrics: Record<string, PRMetrics> = {
        'test/repo#1': {
          testAdditions: 20,
          docAdditions: 5,
          securityPatternMatches: 0,
          totalAdditions: 100,
          totalDeletions: 50,
          filesChanged: 3,
          codeQualityMetrics: {
            cyclomaticComplexity: {
              average: 5.5,
              maximum: 12,
              violationsCount: 1,
              files: [
                {
                  path: 'src/example.js',
                  score: 5.5,
                  functions: [
                    { name: 'complexFunction', line: 1, score: 12 },
                    { name: 'simpleFunction', line: 15, score: 2 }
                  ]
                }
              ]
            },
            cognitiveComplexity: {
              average: 8.0,
              maximum: 15,
              violationsCount: 0,
              files: []
            },
            nestingDepth: {
              average: 2.5,
              maximum: 4,
              violationsCount: 0,
              files: []
            },
            functionLength: {
              average: 25,
              maximum: 45,
              violationsCount: 0,
              files: []
            },
            codeDuplication: {
              percentage: 3.5,
              linesCount: 7,
              blocksCount: 1,
              duplicatedBlocks: []
            },
            namingConventions: {
              overall: 85,
              categories: { variables: 10, functions: 8, classes: 2, files: 3 },
              violations: []
            },
            solidPrinciples: {
              overall: 75,
              principles: {
                singleResponsibility: 80,
                openClosed: 70,
                liskovSubstitution: 90,
                interfaceSegregation: 85,
                dependencyInversion: 60
              },
              violations: []
            },
            codeSmells: [],
            antiPatterns: [],
            languageIdioms: {
              overall: 90,
              language: 'javascript',
              idiomUsage: []
            },
            designPatterns: []
          }
        }
      };

      const codeQualityAnalysis = analysisTools.generateCodeQualityAnalysis(mockMetrics);

      expect(codeQualityAnalysis).toBeDefined();
      expect(codeQualityAnalysis.overallScore).toBeGreaterThan(0);
      expect(codeQualityAnalysis.complexityAnalysis.averageCyclomaticComplexity).toBe(5.5);
      expect(codeQualityAnalysis.maintainabilityAnalysis.duplicationPercentage).toBe(3.5);
      expect(codeQualityAnalysis.maintainabilityAnalysis.namingConventionScore).toBe(85);
      expect(codeQualityAnalysis.bestPracticesAnalysis.languageIdiomScore).toBe(90);
    });

    it('should handle metrics without code quality data', () => {
      const mockMetrics: Record<string, PRMetrics> = {
        'test/repo#1': {
          testAdditions: 20,
          docAdditions: 5,
          securityPatternMatches: 0,
          totalAdditions: 100,
          totalDeletions: 50,
          filesChanged: 3
          // No codeQualityMetrics
        }
      };

      const codeQualityAnalysis = analysisTools.generateCodeQualityAnalysis(mockMetrics);

      expect(codeQualityAnalysis).toBeDefined();
      expect(codeQualityAnalysis.overallScore).toBe(0);
      expect(codeQualityAnalysis.complexityAnalysis.recommendations).toContain('No code quality metrics available for analysis');
    });

    it('should generate recommendations based on quality thresholds', () => {
      const mockMetrics: Record<string, PRMetrics> = {
        'test/repo#1': {
          testAdditions: 20,
          docAdditions: 5,
          securityPatternMatches: 0,
          totalAdditions: 100,
          totalDeletions: 50,
          filesChanged: 3,
          codeQualityMetrics: {
            cyclomaticComplexity: {
              average: 15, // High complexity
              maximum: 25,
              violationsCount: 3,
              files: []
            },
            cognitiveComplexity: {
              average: 20, // High cognitive complexity
              maximum: 30,
              violationsCount: 2,
              files: []
            },
            nestingDepth: {
              average: 3,
              maximum: 6, // High nesting
              violationsCount: 1,
              files: []
            },
            functionLength: {
              average: 60, // Long functions
              maximum: 120,
              violationsCount: 2,
              files: []
            },
            codeDuplication: {
              percentage: 8, // High duplication
              linesCount: 80,
              blocksCount: 4,
              duplicatedBlocks: []
            },
            namingConventions: {
              overall: 65, // Poor naming
              categories: { variables: 5, functions: 3, classes: 1, files: 2 },
              violations: []
            },
            solidPrinciples: {
              overall: 55, // Poor SOLID adherence
              principles: {
                singleResponsibility: 60,
                openClosed: 50,
                liskovSubstitution: 70,
                interfaceSegregation: 55,
                dependencyInversion: 40
              },
              violations: []
            },
            codeSmells: [
              { type: 'Long Parameter List', file: 'test.js', line: 1, description: 'Too many params', severity: 'medium' as const, suggestion: 'Use parameter object' }
            ],
            antiPatterns: [
              { type: 'God Object', file: 'test.js', lines: [1], description: 'Class too large', impact: 'high' as const, refactoringGuide: 'Split class' }
            ],
            languageIdioms: {
              overall: 70, // Poor idiom usage
              language: 'javascript',
              idiomUsage: []
            },
            designPatterns: []
          }
        }
      };

      const codeQualityAnalysis = analysisTools.generateCodeQualityAnalysis(mockMetrics);

      // Should generate recommendations for high complexity
      expect(codeQualityAnalysis.complexityAnalysis.recommendations).toContain('Reduce cyclomatic complexity by breaking down complex functions');
      expect(codeQualityAnalysis.complexityAnalysis.recommendations).toContain('Simplify cognitive complexity by reducing nested conditions');
      expect(codeQualityAnalysis.complexityAnalysis.recommendations).toContain('Reduce nesting depth by extracting methods or using early returns');
      expect(codeQualityAnalysis.complexityAnalysis.recommendations).toContain('Break down long functions into smaller, more focused functions');

      // Should generate recommendations for maintainability issues
      expect(codeQualityAnalysis.maintainabilityAnalysis.recommendations).toContain('Reduce code duplication by extracting common functionality');
      expect(codeQualityAnalysis.maintainabilityAnalysis.recommendations).toContain('Improve naming conventions for better code readability');
      expect(codeQualityAnalysis.maintainabilityAnalysis.recommendations).toContain('Review SOLID principles adherence to improve code design');

      // Should generate recommendations for best practices
      expect(codeQualityAnalysis.bestPracticesAnalysis.recommendations).toContain('Follow language-specific idioms and best practices');
      expect(codeQualityAnalysis.bestPracticesAnalysis.recommendations).toContain('Refactor identified anti-patterns to improve code quality');
    });
  });
});