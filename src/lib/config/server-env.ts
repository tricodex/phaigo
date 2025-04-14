import { z } from 'zod';

/**
 * Server-side environment schema
 * This schema includes variables that should NEVER be exposed to the client
 */
const serverEnvSchema = z.object({
  // GCP API Key - This should only be used server-side
  GCP_API_KEY: z.string().min(1, {
    message: 'GCP API key is required for server-side operations',
  }),

  // Gemini API Key - This should only be used server-side
  GEMINI_API_KEY: z.string().min(1, {
    message: 'Gemini API key is required for server-side operations',
  }),
  
  // RPC endpoints (server-side only)
  GCP_HTTP_ENDPOINT_MAINNET: z.string().url({
    message: 'Invalid Mainnet HTTP endpoint URL',
  }),
  GCP_HTTP_ENDPOINT_SEPOLIA: z.string().url({
    message: 'Invalid Sepolia HTTP endpoint URL',
  }),
  
  // Database connection
  DATABASE_URL: z.string().min(1, {
    message: 'Database URL is required',
  }),
  
  // Database configuration
  POSTGRES_USER: z.string().min(1, {
    message: 'Postgres user is required',
  }).optional(),
  POSTGRES_PASSWORD: z.string().min(1, {
    message: 'Postgres password is required',
  }).optional(),
  POSTGRES_DB: z.string().min(1, {
    message: 'Postgres database name is required',
  }).optional(),
});

/**
 * Validates and exports the server environment
 * Will throw an error if any required variables are missing
 */
export const serverEnv = (() => {
  try {
    return serverEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n  ');
      throw new Error(`❌ Invalid or missing server environment variables:\n  ${missingVars}`);
    }
    throw error;
  }
})();

/**
 * Server environment type
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Create endpoint URLs with API key appended
 * This is a safe way to use API keys without exposing them to the client
 */
export function getSecureEndpointUrl(baseUrl: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}key=${serverEnv.GCP_API_KEY}`;
}

/**
 * Get HTTP RPC URL with API key for a specific network
 * This should ONLY be used in server-side code, never in client components
 */
export function getServerRpcUrl(network: 'mainnet' | 'sepolia'): string {
  const endpoints = {
    mainnet: serverEnv.GCP_HTTP_ENDPOINT_MAINNET,
    sepolia: serverEnv.GCP_HTTP_ENDPOINT_SEPOLIA
  };
  
  return getSecureEndpointUrl(endpoints[network]);
}

/**
 * Get WebSocket RPC URL with API key for a specific network
 * This should ONLY be used in server-side API routes that proxy WS connections
 */
export function getServerWsUrl(network: 'mainnet' | 'sepolia'): string {
  const wsBaseUrl = network === 'mainnet' 
    ? process.env.NEXT_PUBLIC_GCP_WS_ENDPOINT_MAINNET 
    : process.env.NEXT_PUBLIC_GCP_WS_ENDPOINT_SEPOLIA;
    
  if (!wsBaseUrl) {
    throw new Error(`WebSocket URL for ${network} not found in environment variables`);
  }
  
  return getSecureEndpointUrl(wsBaseUrl);
}

/**
 * Safely initialize GCP API services
 * This should be used on the server-side API routes
 */
export function initGcpApiClient() {
  // This is where you would initialize any server-side GCP API clients
  // using the API key from serverEnv
  return {
    apiKey: serverEnv.GCP_API_KEY,
    // Add other initialization properties here
  };
} 