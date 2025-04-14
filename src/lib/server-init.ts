// This file initializes server-side services for Next.js
// It's imported in server components or API routes that need to use these services

import { initializeServer, cleanupServer } from '@/app/api/server-startup';
import { isDevelopment, isServer } from './config/environment';

// Initialize global state
let isInitialized = false;

// Initialize the server
export async function ensureServerInitialized(): Promise<void> {
  if (!isInitialized) {
    await initializeServer();
    isInitialized = true;
    
    // Set up cleanup handlers for graceful shutdown
    ['SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, () => {
        console.log(`Received ${signal}, shutting down...`);
        cleanupServer();
        process.exit(0);
      });
    });
  }
}

// This gets imported in Next.js API routes or server components
// Next.js handles the lifecycle, so we prevent it from being imported in client components
if (isServer) {
  // In development mode, initialize the server immediately
  // In production, it will be initialized by the first API route or server component that imports this file
  if (isDevelopment) {
    ensureServerInitialized().catch(error => {
      console.error('Failed to initialize server in development mode:', error);
    });
  }
} 