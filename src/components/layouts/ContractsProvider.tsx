"use client";

import { createContext, useContext, ReactNode, useEffect, useRef, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { PyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import { useChainId } from 'wagmi';
import type { Network } from '@/types/network';

interface ContractsContextType {
  pyusdToken: PyusdTokenService | null;
  network: Network;
  isReady: boolean;
}

// Create a singleton instance outside of the component tree
const tokenServiceInstance = new PyusdTokenService();

// Default network
const DEFAULT_NETWORK: Network = 'sepolia';

// Create default context state for loading/initial phase
const defaultContextValue: ContractsContextType = {
  pyusdToken: tokenServiceInstance,
  network: DEFAULT_NETWORK,
  isReady: false,
};

// Create context with the default value
const ContractsContext = createContext<ContractsContextType>(defaultContextValue);

export function ContractsProvider({ children }: { children: ReactNode }) {
  const isMountedRef = useRef(false);
  // ---> Add isReady state for this provider
  const [isReady, setIsReady] = useState(false);
  // ---> Use state for network, update only when ready
  const [network, setNetwork] = useState<Network>(DEFAULT_NETWORK);
  
  // Get wagmi data 
  const { isConnected } = useAccount();
  const chainId = useChainId();

  // Effect to mark as ready after mount
  useEffect(() => {
    isMountedRef.current = true;
    // Defer setting ready state to avoid render-phase updates
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        console.log("ContractsProvider: Setting isReady to true");
        setIsReady(true);
      }
    }, 50); // Slightly longer delay to ensure hydration is fully complete
    
    return () => {
      isMountedRef.current = false;
      // ---> Clear the timeout
      clearTimeout(timeoutId);
    };
  }, []);

  // Effect to update network based on chainId, only when ready
  useEffect(() => {
    // Only run if the provider is ready and connected
    if (isReady && isConnected) {
      const currentNetwork: Network = chainId === 1 ? 'mainnet' : 'sepolia';
      if (network !== currentNetwork) {
        console.log(`ContractsProvider: Network changed to ${currentNetwork}`);
        setNetwork(currentNetwork);
      }
    }
    // Reset to default if disconnected after being ready
    else if (isReady && !isConnected && network !== DEFAULT_NETWORK) {
      console.log("ContractsProvider: Disconnected, resetting network to default");
      setNetwork(DEFAULT_NETWORK);
    }
  }, [chainId, isReady, isConnected, network]); // Depend on isReady and isConnected
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    pyusdToken: tokenServiceInstance, // Singleton instance
    network: network,                // Current network state
    isReady: isReady                 // Readiness state of the provider
  }), [network, isReady]);

  console.log("ContractsProvider rendering. isReady:", isReady, "Network:", network);

  return (
    <ContractsContext.Provider value={contextValue}>
      {children}
    </ContractsContext.Provider>
  );
}

export function useContracts() {
  const context = useContext(ContractsContext);
  if (context === undefined) {
    throw new Error('useContracts must be used within a ContractsProvider');
  }
  // Optionally check context.isReady before allowing full use
  // if (!context.isReady) {
  //   console.warn("useContracts called before ContractsProvider is ready.");
  //   // Return default or loading state if needed
  // }
  return context;
}

export default ContractsProvider;