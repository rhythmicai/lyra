import { PerformanceIssues } from '../types/index.js';

/**
 * Performance Analysis Tools for detecting various performance anti-patterns
 * in code diffs and providing actionable insights.
 */
export class PerformanceAnalysisTools {
  
  /**
   * Analyze a diff for performance issues across all categories
   */
  analyzePerformanceIssues(diff: string, filenames: string[]): PerformanceIssues {
    const lines = diff.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
    
    return {
      // Database performance
      nPlusOneQueries: this.detectNPlusOneQueries(addedLines),
      inefficientJoins: this.detectInefficientJoins(addedLines),
      missingIndexSuggestions: this.detectMissingIndexOpportunities(addedLines),
      queryOptimizationOpportunities: this.detectQueryOptimizationOpportunities(addedLines),
      
      // Code performance
      algorithmicComplexityIssues: this.detectAlgorithmicComplexityIssues(addedLines),
      memoryLeakPatterns: this.detectMemoryLeakPatterns(addedLines),
      inefficientLoops: this.detectInefficientLoops(addedLines),
      resourceManagementIssues: this.detectResourceManagementIssues(addedLines),
      
      // Runtime performance
      blockingOperations: this.detectBlockingOperations(addedLines),
      asyncAwaitIssues: this.detectAsyncAwaitIssues(addedLines),
      eventLoopBlocking: this.detectEventLoopBlocking(addedLines),
      performanceAntiPatterns: this.detectPerformanceAntiPatterns(addedLines),
      
      // Frontend performance
      bundleSizeIssues: this.detectBundleSizeIssues(addedLines, filenames),
      renderPerformanceIssues: this.detectRenderPerformanceIssues(addedLines),
      memoryUsageIssues: this.detectMemoryUsageIssues(addedLines),
      networkOptimizationIssues: this.detectNetworkOptimizationIssues(addedLines)
    };
  }

  /**
   * Generate human-readable performance insights from detected issues
   */
  generatePerformanceInsights(issues: PerformanceIssues): {
    findings: string[];
    recommendations: string[];
    risks: Array<{ level: 'high' | 'medium' | 'low'; description: string }>;
  } {
    const findings: string[] = [];
    const recommendations: string[] = [];
    const risks: Array<{ level: 'high' | 'medium' | 'low'; description: string }> = [];

    // Database performance findings
    if (issues.nPlusOneQueries > 0) {
      findings.push(`${issues.nPlusOneQueries} potential N+1 query patterns detected`);
      risks.push({
        level: 'high',
        description: 'N+1 queries can severely impact database performance under load'
      });
      recommendations.push('Review query patterns and consider using eager loading or batching');
    }

    if (issues.inefficientJoins > 0) {
      findings.push(`${issues.inefficientJoins} potentially inefficient join patterns found`);
      risks.push({
        level: 'medium',
        description: 'Inefficient joins can cause slow query performance'
      });
      recommendations.push('Optimize join queries and ensure proper indexing');
    }

    if (issues.missingIndexSuggestions > 0) {
      findings.push(`${issues.missingIndexSuggestions} queries that might benefit from indexes`);
      recommendations.push('Consider adding database indexes for frequently queried columns');
    }

    // Code performance findings
    if (issues.algorithmicComplexityIssues > 0) {
      findings.push(`${issues.algorithmicComplexityIssues} potentially high-complexity algorithms detected`);
      risks.push({
        level: 'medium',
        description: 'High algorithmic complexity can cause performance bottlenecks'
      });
      recommendations.push('Review algorithm efficiency and consider optimization');
    }

    if (issues.memoryLeakPatterns > 0) {
      findings.push(`${issues.memoryLeakPatterns} potential memory leak patterns found`);
      risks.push({
        level: 'high',
        description: 'Memory leaks can cause application instability and crashes'
      });
      recommendations.push('Review memory management and ensure proper cleanup');
    }

    if (issues.inefficientLoops > 0) {
      findings.push(`${issues.inefficientLoops} inefficient loop patterns detected`);
      recommendations.push('Consider optimizing loops or using more efficient data structures');
    }

    // Runtime performance findings
    if (issues.blockingOperations > 0) {
      findings.push(`${issues.blockingOperations} blocking operations detected in async context`);
      risks.push({
        level: 'high',
        description: 'Blocking operations can freeze the event loop and degrade performance'
      });
      recommendations.push('Replace blocking operations with async alternatives');
    }

    if (issues.asyncAwaitIssues > 0) {
      findings.push(`${issues.asyncAwaitIssues} async/await pattern issues found`);
      recommendations.push('Review async/await usage for proper error handling and performance');
    }

    // Frontend performance findings
    if (issues.bundleSizeIssues > 0) {
      findings.push(`${issues.bundleSizeIssues} potential bundle size optimization opportunities`);
      recommendations.push('Consider code splitting, tree shaking, or lazy loading');
    }

    if (issues.renderPerformanceIssues > 0) {
      findings.push(`${issues.renderPerformanceIssues} potential render performance issues`);
      recommendations.push('Review component rendering patterns and consider memoization');
    }

    return { findings, recommendations, risks };
  }

  // Database Performance Detection Methods

  private detectNPlusOneQueries(lines: string[]): number {
    let count = 0;
    let inLoop = false;

    for (const line of lines) {
      // Check for loop constructs - simplified pattern
      if (line.includes('for (') || line.includes('for(')) {
        inLoop = true;
      }
      
      // If we're in a loop and see database queries, it might be N+1
      if (inLoop && (
          line.includes('prisma.') ||
          line.includes('.findMany') ||
          line.includes('.findOne') ||
          line.includes('.findAll') ||
          (line.includes('await') && line.includes('.find'))
        )) {
        count++;
      }

      // Check for closing braces to exit loop (after checking for queries)
      if (line.includes('}')) {
        inLoop = false;
      }
    }

    return count;
  }

  private detectInefficientJoins(lines: string[]): number {
    let count = 0;
    const inefficientJoinPatterns = [
      // SQL patterns that might be inefficient
      /JOIN\s+\w+\s+ON\s+1\s*=\s*1/i, // Cartesian product
      /JOIN.*WHERE.*OR/i, // Complex join conditions
      /LEFT\s+JOIN.*IS\s+NULL/i, // Anti-joins that could be optimized
      // Multiple large table joins
      /JOIN.*JOIN.*JOIN/i
    ];

    for (const line of lines) {
      if (inefficientJoinPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectMissingIndexOpportunities(lines: string[]): number {
    let count = 0;
    const indexOpportunityPatterns = [
      // WHERE clauses that might benefit from indexes
      /WHERE\s+\w+\s*=\s*/i,
      /ORDER\s+BY\s+\w+/i,
      /GROUP\s+BY\s+\w+/i,
      // ORM patterns that suggest frequent queries
      /\.where\s*\(/i,
      /\.orderBy\s*\(/i,
      /\.groupBy\s*\(/i
    ];

    for (const line of lines) {
      if (indexOpportunityPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectQueryOptimizationOpportunities(lines: string[]): number {
    let count = 0;
    const optimizationPatterns = [
      // SELECT * queries
      /SELECT\s+\*/i,
      // Subqueries that could be joins
      /SELECT.*\(\s*SELECT/i,
      // No LIMIT on potentially large results
      /SELECT.*FROM.*WHERE(?!.*LIMIT)/i,
      // Functions in WHERE clauses
      /WHERE.*\w+\s*\(/i
    ];

    for (const line of lines) {
      if (optimizationPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  // Code Performance Detection Methods

  private detectAlgorithmicComplexityIssues(lines: string[]): number {
    let count = 0;
    let nestedLoops = 0;

    for (const line of lines) {
      // Count nested loops (simplified heuristic)
      if (line.match(/\+.*\b(for|while|forEach)\s*\(/)) {
        nestedLoops++;
        if (nestedLoops > 1) {
          count++; // Nested loops indicate higher complexity
        }
      }
      
      if (line.match(/\+.*}/)) {
        nestedLoops = Math.max(0, nestedLoops - 1);
      }

      // Recursive function calls
      if (line.match(/\+.*function\s+(\w+).*\1\s*\(/)) {
        count++;
      }

      // Potentially expensive operations in loops
      if (line.match(/\+.*\.(sort|reverse|splice)\s*\(/)) {
        count++;
      }
    }

    return count;
  }

  private detectMemoryLeakPatterns(lines: string[]): number {
    let count = 0;
    const memoryLeakPatterns = [
      // Event listeners without cleanup
      /addEventListener.*(?!removeEventListener)/i,
      // Timers without cleanup
      /setInterval|setTimeout.*(?!clear)/i,
      // Growing arrays/objects in closures
      /\w+\.push\s*\(/,
      // DOM references without cleanup
      /document\.getElementById|querySelector.*(?!null)/i,
      // Circular references
      /\w+\.\w+\s*=\s*\w+/
    ];

    for (const line of lines) {
      if (memoryLeakPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectInefficientLoops(lines: string[]): number {
    let count = 0;
    const inefficientLoopPatterns = [
      // Synchronous operations in loops (more flexible)
      /\+.*\.(sync|readFileSync|writeFileSync)/i,
      // Database queries in loops (look for database operations with await)
      /\+.*await.*\.(find|query|save|update|delete)/i,
      // DOM manipulation in loops
      /\+.*\.(getElementById|querySelector|appendChild)/i,
      // Array operations that could be optimized
      /\+.*\.(indexOf|includes|find)\s*\(/i,
      // General pattern for operations in loops
      /\+.*for.*await/i
    ];

    let inLoop = false;

    for (const line of lines) {
      // Track if we're in a for loop context
      if (line.match(/\+.*for\s*\(/)) {
        inLoop = true;
      }
      
      // Reset loop context on closing brace
      if (line.match(/\+.*}/)) {
        inLoop = false;
      }

      // Check for inefficient patterns
      if (inefficientLoopPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
      
      // Also check for database operations within detected loops
      if (inLoop && line.match(/\+.*\.(save|update|delete|find|query)/i)) {
        count++;
      }
    }

    return count;
  }

  private detectResourceManagementIssues(lines: string[]): number {
    let count = 0;
    const resourceIssuePatterns = [
      // File operations without proper cleanup
      /fs\.(open|createReadStream|createWriteStream).*(?!close|end)/i,
      // Database connections without cleanup
      /connect\(.*(?!disconnect|close)/i,
      // HTTP requests without timeout
      /fetch\(.*(?!timeout|AbortController)/i,
      // Missing error handling on resources
      /\.(open|connect|read|write)\s*\((?!.*catch|try)/i
    ];

    for (const line of lines) {
      if (resourceIssuePatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  // Runtime Performance Detection Methods

  private detectBlockingOperations(lines: string[]): number {
    let count = 0;
    const blockingOperations = [
      // Synchronous file operations
      /fs\.(readFileSync|writeFileSync|existsSync|statSync)/i,
      // Synchronous HTTP
      /xhr\.open\s*\(\s*['"]\w+['"],.*,\s*false/i,
      // Blocking crypto operations
      /crypto\.(pbkdf2Sync|scryptSync|randomBytesSync)/i,
      // Synchronous child process
      /child_process\.(execSync|spawnSync)/i
    ];

    for (const line of lines) {
      if (blockingOperations.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectAsyncAwaitIssues(lines: string[]): number {
    let count = 0;
    const asyncIssuePatterns = [
      // Await in loops (sequential instead of parallel)
      /\+.*for.*await\s+/i,
      // Sequential await patterns that could be parallel
      /\+.*await.*fetch/i,
      // Unhandled promise rejections
      /\+.*new\s+Promise.*(?!catch)/i,
      // Promise without proper handling
      /\+.*\.then\(\)(?!\s*\.catch)/i,
      // Missing await
      /\+.*fetch\(.*\)(?!\s*\.then|\s*\.catch|\s*await)/i
    ];

    for (const line of lines) {
      if (asyncIssuePatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectEventLoopBlocking(lines: string[]): number {
    let count = 0;
    const blockingPatterns = [
      // CPU-intensive operations
      /while\s*\(\s*true\s*\)/i,
      /for\s*\(\s*.*;\s*.*;\s*.*\)\s*{[^}]*for/i, // nested loops
      // Large data processing without yielding
      /JSON\.(parse|stringify)\s*\(\s*\w+\s*\)/,
      // Synchronous regex with complex patterns
      /\.match\s*\(\/.*\+.*\+.*\//
    ];

    for (const line of lines) {
      if (blockingPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectPerformanceAntiPatterns(lines: string[]): number {
    let count = 0;
    const antiPatterns = [
      // Frequent object creation in loops
      /\+.*for.*new\s+\w+\s*\(/i,
      // String concatenation in loops
      /\+.*for.*\w+\s*\+=\s*['"]/i,
      // Deep cloning of large objects
      /JSON\.parse\s*\(\s*JSON\.stringify/i,
      // Inefficient data structure usage
      /Array\(.*\)\.fill/i
    ];

    for (const line of lines) {
      if (antiPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  // Frontend Performance Detection Methods

  private detectBundleSizeIssues(lines: string[], filenames: string[]): number {
    let count = 0;
    
    // Check for large library imports
    const heavyLibraryPatterns = [
      /import.*from\s+['"]lodash['"]/i,
      /import.*from\s+['"]moment['"]/i,
      /import.*from\s+['"]@material-ui['"]/i,
      /require\s*\(\s*['"]entire-library['"]/i
    ];

    // Check for webpack bundle analysis files
    const bundleAnalysisFiles = filenames.filter(f => 
      f.includes('webpack-bundle-analyzer') || 
      f.includes('bundle-analyzer') ||
      f.includes('.bundle.js')
    );
    
    if (bundleAnalysisFiles.length > 0) {
      count += bundleAnalysisFiles.length;
    }

    for (const line of lines) {
      if (heavyLibraryPatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectRenderPerformanceIssues(lines: string[]): number {
    let count = 0;
    const renderIssuePatterns = [
      // React performance issues
      /\+.*useEffect\s*\(\s*\(\s*\)\s*=>/i, // useEffect without dependencies
      /\+.*render\s*\(\s*\)\s*{[^}]*for/i, // loops in render
      /\+.*map\s*\(\s*.*=>\s*<.*(?!key=)/i, // missing keys in lists
      // Vue performance issues
      /v-for.*(?!:key)/i,
      // Angular performance issues
      /\*ngFor.*(?!trackBy)/i
    ];

    for (const line of lines) {
      if (renderIssuePatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectMemoryUsageIssues(lines: string[]): number {
    let count = 0;
    const memoryIssuePatterns = [
      // Large data structures
      /new\s+Array\s*\(\s*\d{4,}/i,
      // Memory-intensive operations
      /new\s+Blob\s*\(/i,
      /new\s+ArrayBuffer\s*\(/i,
      // Potential memory leaks in frontend
      /setInterval.*(?!clearInterval)/i,
      /addEventListener.*(?!removeEventListener)/i
    ];

    for (const line of lines) {
      if (memoryIssuePatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }

  private detectNetworkOptimizationIssues(lines: string[]): number {
    let count = 0;
    const networkIssuePatterns = [
      // Inefficient API calls
      /fetch\s*\(.*\)\s*\.then.*fetch/i, // sequential API calls
      /for.*fetch\s*\(/i, // API calls in loops
      // Missing request optimization
      /fetch\s*\(.*(?!cache|headers)/i,
      // Large data transfers
      /FormData.*\.append.*\.append.*\.append/i, // multiple large uploads
      // Missing compression
      /Content-Type.*text\/(?!.*gzip)/i
    ];

    for (const line of lines) {
      if (networkIssuePatterns.some(pattern => pattern.test(line))) {
        count++;
      }
    }

    return count;
  }
}