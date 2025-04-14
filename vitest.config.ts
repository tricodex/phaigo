import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Path alias for easier imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Vitest specific configuration
  test: {
    // Use happy-dom as the default environment for component tests
    environment: 'happy-dom',
    
    // Include all test files in the project
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // Exclude node_modules and other non-test directories
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
    
    // Configure coverage reporting
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
    },
    
    // Global test timeout
    testTimeout: 10000,
    
    // Allow for using the global APIs like describe, it, expect without imports
    globals: true,
  },
}); 