import { DocumentationAnalysisTools } from '../src/tools/documentation-analysis-tools.js';

describe('DocumentationAnalysisTools', () => {
  let docTools: DocumentationAnalysisTools;

  beforeEach(() => {
    docTools = new DocumentationAnalysisTools();
  });

  describe('analyzeTypeScriptDocs', () => {
    it('should detect documented functions', async () => {
      const code = `
/**
 * This is a documented function
 * @param name The name parameter
 * @returns A greeting string
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

function undocumentedFunction() {
  return 42;
}
`;

      const result = await docTools.analyzeTypeScriptDocs(code, 'test.ts');
      
      expect(result.metrics.totalFunctions).toBe(2);
      expect(result.metrics.documentedFunctions).toBe(1);
      expect(result.undocumentedSymbols).toContain('function undocumentedFunction');
    });

    it('should detect documented classes', async () => {
      const code = `
/**
 * This is a documented class
 */
export class MyClass {
  constructor() {}
}

class UndocumentedClass {
  method() {}
}
`;

      const result = await docTools.analyzeTypeScriptDocs(code, 'test.ts');
      
      expect(result.metrics.totalClasses).toBe(2);
      expect(result.metrics.documentedClasses).toBe(1);
      expect(result.undocumentedSymbols).toContain('class UndocumentedClass');
    });

    it('should count inline and block comments', async () => {
      const code = `
// This is an inline comment
const x = 1;

/**
 * This is a block comment
 * spanning multiple lines
 */
function test() {
  // Another inline comment
  // TODO: implement this
  // FIXME: bug here
  return true;
}
`;

      const result = await docTools.analyzeTypeScriptDocs(code, 'test.ts');
      
      expect(result.metrics.inlineCommentLines).toBe(4);
      expect(result.metrics.blockCommentLines).toBe(4);
      expect(result.metrics.todoCount).toBe(1);
      expect(result.metrics.fixmeCount).toBe(1);
    });
  });

  describe('analyzeMarkdownDocs', () => {
    it('should analyze README completeness', async () => {
      const readme = `# My Project

## Description
This is a great project.

## Installation
\`\`\`bash
npm install my-project
\`\`\`

## Usage
\`\`\`javascript
const project = require('my-project');
\`\`\`

## License
MIT
`;

      const result = await docTools.analyzeMarkdownDocs(readme);
      
      expect(result.completeness).toBeGreaterThan(50);
      expect(result.missingSection).toContain('api');
      expect(result.missingSection).toContain('contributing');
    });
  });

  describe('generateDocumentationSuggestions', () => {
    it('should generate appropriate suggestions', () => {
      const metrics = {
        totalFunctions: 10,
        documentedFunctions: 3,
        totalClasses: 5,
        documentedClasses: 2,
        totalMethods: 0,
        documentedMethods: 0,
        totalParameters: 0,
        documentedParameters: 0,
        totalExports: 0,
        documentedExports: 0,
        inlineCommentLines: 5,
        blockCommentLines: 10,
        todoCount: 8,
        fixmeCount: 3,
        commentToCodeRatio: 0.05,
        hasReadme: false,
        readmeCompleteness: 0,
        hasContributing: false,
        hasApiDocs: false,
        markdownFileCount: 0,
        overallDocScore: 25,
        codeDocScore: 20,
        projectDocScore: 30
      };

      const suggestions = docTools.generateDocumentationSuggestions(metrics);
      
      expect(suggestions).toContain('Document 7 functions missing JSDoc comments');
      expect(suggestions).toContain('Add class documentation for 3 classes');
      expect(suggestions).toContain('Increase inline documentation (aim for 15-20% comment-to-code ratio)');
      expect(suggestions).toContain('Address 11 TODO/FIXME comments');
      expect(suggestions).toContain('Create or update README.md with project overview');
    });
  });
});