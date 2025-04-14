import { clientEnv } from '@/lib/config/env';
import { createRpcUrl } from '@/lib/utils/url-helpers';

/**
 * Network type for blockchain networks supported in the application
 */
export type Network = 'mainnet' | 'sepolia';

/**
 * Check if a string is a valid network
 */
export const isValidNetwork = (network: string): boolean => {
  if (!network) return false;
  return ['mainnet', 'sepolia'].includes(network);
};

/**
 * Get network chain ID
 */
export const getNetworkChainId = (network: Network): number => {
  const chainIds = {
    mainnet: 1,
    sepolia: 11155111,
  };
  
  return chainIds[network];
};

/**
 * Get network name for display
 */
export const getNetworkNameForDisplay = (network: Network): string => {
  switch (network) {
    case 'mainnet':
      return 'Ethereum Mainnet';
    case 'sepolia':
      return 'Sepolia Testnet';
    default:
      return 'Unknown Network';
  }
};

/**
 * Get explorer URL for a network
 */
export const getExplorerUrl = (
  network: Network,
  hash: string,
  type: 'tx' | 'address' = 'tx'
): string => {
  const baseUrls: Record<Network, string> = {
    mainnet: 'https://etherscan.io',
    sepolia: 'https://sepolia.etherscan.io',
  };

  return `${baseUrls[network]}/${type}/${hash}`;
};

/**
 * Get base RPC URL for a network (client-side)
 * For client usage without API keys - actual connections should go through API routes
 */
export const getRpcUrl = (network: Network): string => {
  const baseUrls: Record<Network, string> = {
    mainnet: 'https://blockchain.googleapis.com/v1/projects/kodaworld-91430/locations/us-central1/endpoints/ethereum-mainnet/rpc',
    sepolia: 'https://blockchain.googleapis.com/v1/projects/kodaworld-91430/locations/us-central1/endpoints/ethereum-sepolia/rpc'
  };

  return baseUrls[network];
};

/**
 * Get WebSocket URL for a network (client-side safe)
 * Used only for client-side WebSocket connections, does not include API key
 */
export const getWsUrl = (network: Network): string => {
  const baseUrls: Record<Network, string> = {
    mainnet: clientEnv.NEXT_PUBLIC_GCP_WS_ENDPOINT_MAINNET,
    sepolia: clientEnv.NEXT_PUBLIC_GCP_WS_ENDPOINT_SEPOLIA
  };
  
  return baseUrls[network];
};

/**
 * Get the PYUSD contract address for a specific network
 */
export const getPyusdContractAddress = (network: Network): string => {
  switch (network) {
    case 'mainnet':
      return clientEnv.NEXT_PUBLIC_PYUSD_CONTRACT_ADDRESS;
    case 'sepolia':
      return clientEnv.NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS;
    default:
      return clientEnv.NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS;
  }
};

/**
 * Get the HTTP RPC URL for client-side use with ethers.js
 * Creates a full URL with proper protocol for the API route
 */
export const getProxyRpcUrl = (network: Network): string => {
  return createRpcUrl('/api/blockchain/rpc', { network });
};

/**
 * Get the WebSocket proxy URL for client-side use
 * This API route handles authentication securely without exposing API keys
 */
export const getWsProxyUrl = (network: Network): string => {
  // Use createRpcUrl to ensure proper URL format for ethers.js
  return createRpcUrl('/api/blockchain/ws-proxy', { network });
};