import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'frontend',
          include: ['frontend/tests/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
