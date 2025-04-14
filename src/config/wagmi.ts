'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';
import type { Chain } from 'wagmi/chains';

// Get RPC URLs from the environment
const getRpcUrl = (chainId: number): string => {
  // Ethers.js requires URLs with http/https protocol for its providers
  switch (chainId) {
    case 1: // mainnet
      return '/api/blockchain/rpc?network=mainnet';
    case 11155111: // sepolia
      return '/api/blockchain/rpc?network=sepolia';
    default:
      return '/api/blockchain/rpc?network=sepolia';
  }
};

// Create transports with our API-proxied RPC endpoints
const transports = {
  [mainnet.id]: http(getRpcUrl(mainnet.id)),
  [sepolia.id]: http(getRpcUrl(sepolia.id)),
};

// Create queryClient outside of component to avoid recreation during render
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 10 * 1000, // 10 seconds
      gcTime: 60 * 60 * 1000, // 1 hour
      refetchOnWindowFocus: false,
    },
  },
});

// Create lazy config initialization to avoid issues during SSR and React 19 render phase
let _config: ReturnType<typeof createConfig> | undefined;

export const getWagmiConfig = () => {
  // If already created, return the existing config
  if (_config) return _config;
  
  // Only create the config once
  _config = createConfig({
    chains: [mainnet, sepolia],
    transports,
  });
  
  return _config;
};

// For backward compatibility - existing code can still use config directly
export const config = typeof window === 'undefined' 
  ? createConfig({
      chains: [mainnet, sepolia],
      transports,
    })
  : getWagmiConfig();

// Export GCP Blockchain RPC chains
export const gcpBlockchainRpcChain: Record<string, Chain> = {
  mainnet: {
    ...mainnet,
    rpcUrls: {
      ...mainnet.rpcUrls,
      default: { http: [getRpcUrl(mainnet.id)] },
      public: { http: [getRpcUrl(mainnet.id)] },
    }
  },
  sepolia: {
    ...sepolia,
    rpcUrls: {
      ...sepolia.rpcUrls,
      default: { http: [getRpcUrl(sepolia.id)] },
      public: { http: [getRpcUrl(sepolia.id)] },
    }
  }
};