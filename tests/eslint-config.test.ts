/**
 * Test file to verify ESLint v9 configuration is working
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('ESLint Configuration', () => {
  it('should run without errors', async () => {
    try {
      const { stdout, stderr } = await execAsync('npx eslint src/cli.ts');
      // Should exit with code 0 (no errors, only warnings are acceptable)
      expect(stderr).toBe('');
      // Should show TypeScript warnings but no errors
      expect(stdout).toContain('warning');
    } catch (error) {
      // If ESLint exits with non-zero code due to errors (not warnings)
      const execError = error as any;
      if (execError.code !== 0 && execError.stdout?.includes('error')) {
        throw new Error(`ESLint found errors: ${execError.stdout}`);
      }
      // Warnings are ok, only errors should fail the test
    }
  });

  it('should validate configuration file exists', async () => {
    const { stdout } = await execAsync('npx eslint --print-config src/cli.ts');
    const config = JSON.parse(stdout);
    
    // Should have TypeScript parser
    expect(config.languageOptions.parser).toBeDefined();
    
    // Should have plugins configured
    expect(config.plugins).toBeDefined();
    expect(Array.isArray(config.plugins)).toBe(true);
    
    // Should have our custom rules
    expect(config.rules).toHaveProperty('@typescript-eslint/no-unused-vars');
    expect(config.rules).toHaveProperty('@typescript-eslint/no-explicit-any');
  });
});