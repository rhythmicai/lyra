// Jest setup file
import { config } from 'dotenv';
import { jest } from '@jest/globals';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Set longer timeout for async operations
jest.setTimeout(10000);