import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    testTimeout: 15000,
    projects: [
      {
        test: {
          name: 'backend',
          include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          environment: 'node',
          testTimeout: 15000,
        },
      },
      {
        test: {
          name: 'frontend',
          include: ['frontend/tests/**/*.test.{ts,tsx}', 'frontend/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          testTimeout: 15000,
        },
      },
    ],
  },
});
