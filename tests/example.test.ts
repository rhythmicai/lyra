import { describe, test, expect } from '@jest/globals';

describe('Example Test Suite', () => {
  test('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('should concatenate strings', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });

  test('should handle arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});