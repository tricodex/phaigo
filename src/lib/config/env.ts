import { z } from 'zod';

/**
 * Server-side environment schema
 * These variables are only available on the server and should never be exposed to the client
 */
const serverEnvSchema = z.object({
  // GCP API Key - kept server-side only for security
  GCP_API_KEY: z.string().min(1, {
    message: 'GCP API key is required for server-side operations',
  }),
  
  // GCP Blockchain RPC Endpoints (server-side only)
  GCP_HTTP_ENDPOINT_MAINNET: z.string().url({
    message: 'Invalid Mainnet HTTP endpoint URL',
  }),
  GCP_HTTP_ENDPOINT_SEPOLIA: z.string().url({
    message: 'Invalid Sepolia HTTP endpoint URL',
  }),
});

// Default values for client environment
const clientEnvDefaults = {
  NEXT_PUBLIC_GCP_WS_ENDPOINT_SEPOLIA: 'wss://blockchain.googleapis.com/v1/projects/kodaworld-91430/locations/us-central1/endpoints/ethereum-sepolia/rpc',
  NEXT_PUBLIC_GCP_WS_ENDPOINT_MAINNET: 'wss://blockchain.googleapis.com/v1/projects/kodaworld-91430/locations/us-central1/endpoints/ethereum-mainnet/rpc',
  NEXT_PUBLIC_PYUSD_CONTRACT_ADDRESS: '0x6c3ea9036406852006290770bedfcaba0e23a0e8',
  NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: '',
  NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_MAINNET: 'https://ethereum.rpc.thirdweb.com',
  NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_SEPOLIA: 'https://ethereum-sepolia.rpc.thirdweb.com'
};

/**
 * Client-side environment schema for Next.js public variables
 * These variables are prefixed with NEXT_PUBLIC_ and will be available in the browser
 */
const clientEnvSchema = z.object({
  // WebSocket endpoints - base URLs ONLY (no API keys)
  NEXT_PUBLIC_GCP_WS_ENDPOINT_SEPOLIA: z.string().url({
    message: 'Invalid Sepolia WebSocket endpoint URL',
  }).startsWith('wss://', {
    message: 'WebSocket URL must start with wss://',
  }).optional().default(clientEnvDefaults.NEXT_PUBLIC_GCP_WS_ENDPOINT_SEPOLIA),
  
  NEXT_PUBLIC_GCP_WS_ENDPOINT_MAINNET: z.string().url({
    message: 'Invalid Mainnet WebSocket endpoint URL',
  }).startsWith('wss://', {
    message: 'WebSocket URL must start with wss://',
  }).optional().default(clientEnvDefaults.NEXT_PUBLIC_GCP_WS_ENDPOINT_MAINNET),
  
  // PYUSD contract addresses
  NEXT_PUBLIC_PYUSD_CONTRACT_ADDRESS: z.string()
    .min(42, { message: 'Invalid Mainnet PYUSD contract address' })
    .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address format' })
    .default(clientEnvDefaults.NEXT_PUBLIC_PYUSD_CONTRACT_ADDRESS),
    
  NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS: z.string()
    .min(42, { message: 'Invalid Testnet PYUSD contract address' })
    .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address format' })
    .default(clientEnvDefaults.NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS),
  
  // WalletConnect Project ID
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string()
    .optional()
    .default(clientEnvDefaults.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
  
  // Fallback RPC endpoints
  NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_MAINNET: z.string()
    .url({ message: 'Invalid fallback Mainnet HTTP endpoint URL' })
    .optional()
    .default(clientEnvDefaults.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_MAINNET),
    
  NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_SEPOLIA: z.string()
    .url({ message: 'Invalid fallback Sepolia HTTP endpoint URL' })
    .optional()
    .default(clientEnvDefaults.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_SEPOLIA),
});

/**
 * Client environment configuration
 * Uses the schema to validate and provide defaults for environment variables
 */
export const clientEnv = (() => {
  try {
    // First try to parse the environment variables
    return clientEnvSchema.parse(process.env);
  } catch (error) {
    // If validation fails, log the error but don't throw
    console.warn('Environment validation failed, using default values:', error);
    
    // Return the default values directly
    return clientEnvDefaults;
  }
})();

/**
 * Server environment validation function
 * This should only be called in server components or API routes
 */
export const getServerEnv = () => {
  try {
    return serverEnvSchema.parse(process.env);
  } catch (error) {
    console.error('Server environment validation failed:', error);
    throw new Error('Server environment validation failed. Please check .env file.');
  }
};

/**
 * Client environment type
 */
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Server environment type
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Combined environment type
 */
export type Env = ClientEnv & ServerEnv; 