'use client';

import { WagmiProvider, type State } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getWagmiConfig } from '@/config/wagmi';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { useEffect, useState, ReactNode } from 'react';
import { clientEnv } from '@/lib/config/env';

// Ensure queryClient is initialized only once
const queryClient = new QueryClient();

// Use environment variable for project ID
const projectId = clientEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Store config in a way that doesn't trigger re-renders on creation
let wagmiConfig: ReturnType<typeof getWagmiConfig> | null = null;
let web3ModalInitialized = false;

function initializeWagmiAndModal() {
  if (typeof window === 'undefined') return false;
  if (!wagmiConfig) {
    try {
      wagmiConfig = getWagmiConfig();
      console.log('Wagmi config initialized.');
    } catch (err) {
      console.error('Failed to initialize Wagmi Config:', err);
      return false;
    }
  }
  if (!web3ModalInitialized && wagmiConfig) {
    try {
      createWeb3Modal({
        wagmiConfig,
        projectId,
        enableAnalytics: false,
        themeMode: 'light',
        featuredWalletIds: ['c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'],
      });
      web3ModalInitialized = true;
      console.log('Web3Modal initialized successfully.');
      return true;
    } catch (err) {
      console.error('Failed to initialize Web3Modal:', err);
      return false;
    }
  }
  return !!wagmiConfig && web3ModalInitialized;
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <p className="text-sm text-gray-500">Initializing Wallet Connection...</p>
    </div>
  );
}

// Root providers component - Simplified
export function Providers({ children, initialState }: { children: ReactNode, initialState?: State }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize on mount
    const success = initializeWagmiAndModal();
    if (success) {
      // Use timeout to ensure state update happens after initial render cycle
      const timer = setTimeout(() => setIsInitialized(true), 0);
      return () => clearTimeout(timer);
    } else {
      // Handle initialization failure (e.g., show an error message)
      console.error("Wagmi/Web3Modal initialization failed.");
      // Potentially set an error state here
    }
  }, []);

  // Render loading or children based on initialization state
  if (!isInitialized || !wagmiConfig) {
    return <LoadingFallback />;
  }

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {/* Directly render children once initialized */}
        {/* We can re-introduce ContractsProvider later if needed, */}
        {/* but let's test stabilization first */}
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 