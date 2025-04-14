/**
 * Environment utility functions for determining runtime environment
 */

/**
 * Check if the current environment is development
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if the current environment is production
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if the current environment is test
 */
export const isTest = process.env.NODE_ENV === 'test';

/**
 * Check if the code is running on the server (vs client)
 */
export const isServer = typeof window === 'undefined';

/**
 * Check if the code is running on the client (browser)
 */
export const isClient = !isServer;

/**
 * Get the current environment (development, production, or test)
 */
export const getEnvironment = () => process.env.NODE_ENV || 'development'; 