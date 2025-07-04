import { describe, test, expect, beforeEach } from '@jest/globals';
import { PerformanceAnalysisTools } from '../src/tools/performance-analysis-tools';
import { PerformanceIssues } from '../src/types';

describe('PerformanceAnalysisTools', () => {
  let performanceTools: PerformanceAnalysisTools;

  beforeEach(() => {
    performanceTools = new PerformanceAnalysisTools();
  });

  describe('Database Performance Analysis', () => {
    test('should detect N+1 query patterns', () => {
      const diff = `
+    for (const user of users) {
+      const posts = await prisma.post.findMany({ where: { userId: user.id } });
+      user.posts = posts;
+    }
`;
      const filenames = ['user-service.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.nPlusOneQueries).toBeGreaterThan(0);
    });

    test('should detect inefficient join patterns', () => {
      const diff = `
+    SELECT * FROM users 
+    JOIN posts ON 1=1 
+    WHERE users.active = true;
`;
      const filenames = ['queries.sql'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.inefficientJoins).toBeGreaterThan(0);
    });

    test('should detect missing index opportunities', () => {
      const diff = `
+    SELECT * FROM users WHERE email = ? ORDER BY created_at;
+    const users = await User.where({ status: 'active' }).orderBy('name');
`;
      const filenames = ['user-queries.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.missingIndexSuggestions).toBeGreaterThan(0);
    });
  });

  describe('Code Performance Analysis', () => {
    test('should detect nested loops (algorithmic complexity)', () => {
      const diff = `
+    for (const user of users) {
+      for (const post of posts) {
+        if (post.userId === user.id) {
+          user.posts.push(post);
+        }
+      }
+    }
`;
      const filenames = ['data-processor.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.algorithmicComplexityIssues).toBeGreaterThan(0);
    });

    test('should detect memory leak patterns', () => {
      const diff = `
+    element.addEventListener('click', handleClick);
+    setInterval(() => { console.log('tick'); }, 1000);
+    const timer = setTimeout(() => { doSomething(); }, 5000);
`;
      const filenames = ['event-handler.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.memoryLeakPatterns).toBeGreaterThan(0);
    });

    test('should detect inefficient loops', () => {
      const diff = `
+    for (const item of items) {
+      const data = fs.readFileSync(item.path);
+      await database.save(item.id, data);
+    }
`;
      const filenames = ['file-processor.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.inefficientLoops).toBeGreaterThan(0);
    });
  });

  describe('Runtime Performance Analysis', () => {
    test('should detect blocking operations', () => {
      const diff = `
+    const data = fs.readFileSync('./large-file.json');
+    const result = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
`;
      const filenames = ['sync-operations.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.blockingOperations).toBeGreaterThan(0);
    });

    test('should detect async/await issues', () => {
      const diff = `
+    for (const url of urls) {
+      await fetch(url);
+    }
+    const promise = fetchData();
+    return promise;
`;
      const filenames = ['async-handler.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.asyncAwaitIssues).toBeGreaterThan(0);
    });

    test('should detect event loop blocking patterns', () => {
      const diff = `
+    while (true) {
+      processData();
+    }
+    const largeData = JSON.parse(megabyteJsonString);
`;
      const filenames = ['processor.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.eventLoopBlocking).toBeGreaterThan(0);
    });
  });

  describe('Frontend Performance Analysis', () => {
    test('should detect bundle size issues', () => {
      const diff = `
+    import * as _ from 'lodash';
+    import moment from 'moment';
`;
      const filenames = ['app.tsx', 'webpack.config.js'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.bundleSizeIssues).toBeGreaterThan(0);
    });

    test('should detect render performance issues', () => {
      const diff = `
+    useEffect(() => {
+      fetchData();
+    });
+    return items.map(item => <Item key={Math.random()} data={item} />);
`;
      const filenames = ['Component.tsx'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.renderPerformanceIssues).toBeGreaterThan(0);
    });

    test('should detect network optimization issues', () => {
      const diff = `
+    for (const id of userIds) {
+      const user = await fetch(\`/api/users/\${id}\`);
+      users.push(user);
+    }
`;
      const filenames = ['api-client.ts'];
      const result = performanceTools.analyzePerformanceIssues(diff, filenames);
      
      expect(result.networkOptimizationIssues).toBeGreaterThan(0);
    });
  });

  describe('Performance Insights Generation', () => {
    test('should generate insights for performance issues', () => {
      const mockIssues: PerformanceIssues = {
        nPlusOneQueries: 2,
        inefficientJoins: 1,
        missingIndexSuggestions: 3,
        queryOptimizationOpportunities: 1,
        algorithmicComplexityIssues: 1,
        memoryLeakPatterns: 2,
        inefficientLoops: 1,
        resourceManagementIssues: 0,
        blockingOperations: 3,
        asyncAwaitIssues: 1,
        eventLoopBlocking: 1,
        performanceAntiPatterns: 0,
        bundleSizeIssues: 1,
        renderPerformanceIssues: 0,
        memoryUsageIssues: 1,
        networkOptimizationIssues: 2
      };

      const insights = performanceTools.generatePerformanceInsights(mockIssues);
      
      expect(insights.findings.length).toBeGreaterThan(0);
      expect(insights.recommendations.length).toBeGreaterThan(0);
      expect(insights.risks.length).toBeGreaterThan(0);
      
      // Check for specific findings
      expect(insights.findings.some(f => f.includes('N+1 query'))).toBe(true);
      expect(insights.findings.some(f => f.includes('memory leak'))).toBe(true);
      expect(insights.findings.some(f => f.includes('blocking operations'))).toBe(true);
      
      // Check for high-risk items
      expect(insights.risks.some(r => r.level === 'high')).toBe(true);
    });

    test('should handle zero performance issues gracefully', () => {
      const mockIssues: PerformanceIssues = {
        nPlusOneQueries: 0,
        inefficientJoins: 0,
        missingIndexSuggestions: 0,
        queryOptimizationOpportunities: 0,
        algorithmicComplexityIssues: 0,
        memoryLeakPatterns: 0,
        inefficientLoops: 0,
        resourceManagementIssues: 0,
        blockingOperations: 0,
        asyncAwaitIssues: 0,
        eventLoopBlocking: 0,
        performanceAntiPatterns: 0,
        bundleSizeIssues: 0,
        renderPerformanceIssues: 0,
        memoryUsageIssues: 0,
        networkOptimizationIssues: 0
      };

      const insights = performanceTools.generatePerformanceInsights(mockIssues);
      
      expect(insights.findings.length).toBe(0);
      expect(insights.recommendations.length).toBe(0);
      expect(insights.risks.length).toBe(0);
    });
  });
});