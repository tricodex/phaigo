"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { PyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import type { Network } from '@/types/network';
import type { Contract as ContractType } from '@/types/contract';

// Define context type
interface ContractsContextType {
  contracts: ContractType[];
  isLoading: boolean;
  error: Error | null;
  refreshContracts: () => Promise<void>;
  network: Network;
}

// Default network
const DEFAULT_NETWORK: Network = 'sepolia';

// Create default context
const ContractsContext = createContext<ContractsContextType>({
  contracts: [],
  isLoading: false,
  error: null,
  refreshContracts: async () => {},
  network: DEFAULT_NETWORK
});

// Create token service instance outside component
const pyusdService = new PyusdTokenService();

export function ContractsProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // Use refs to avoid render-phase updates
  const addressRef = useRef(address);
  const networkRef = useRef<Network>(DEFAULT_NETWORK);
  const hasMountedRef = useRef(false);
  
  // Actual state for UI
  const [contracts, setContracts] = useState<ContractType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Use this for forcing re-renders when network changes
  const [networkState, setNetworkState] = useState<Network>(DEFAULT_NETWORK);
  
  // Update refs in effects, not during render
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  
  // First mark that we've mounted
  useEffect(() => {
    hasMountedRef.current = true;
    
    return () => {
      hasMountedRef.current = false;
    };
  }, []);
  
  // Update network based on chainId in an effect with timeout
  useEffect(() => {
    if (hasMountedRef.current && typeof chainId === 'number') {
      const currentNetwork: Network = chainId === 1 ? 'mainnet' : 'sepolia';
      
      // Only update if changed
      if (networkRef.current !== currentNetwork) {
        networkRef.current = currentNetwork;
        
        // Safely schedule state update outside render
        setTimeout(() => {
          if (hasMountedRef.current) {
            setNetworkState(currentNetwork);
          }
        }, 0);
      }
    }
  }, [chainId]);
  
  // Create a stable fetch function with useCallback
  const fetchContracts = useCallback(async () => {
    if (!addressRef.current || !isConnected) {
      setContracts([]);
      return;
    }
    
    try {
      setIsLoading(true);
      const contractsData = await pyusdService.getContracts(
        addressRef.current, 
        networkRef.current
      );
      
      setContracts(contractsData);
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError(err instanceof Error ? err : new Error('Failed to load contracts'));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]); // Only depends on isConnected since other dependencies are refs

  // Only fetch contracts when we're connected and have an address
  useEffect(() => {
    // Avoid fetch during SSR
    if (!hasMountedRef.current) return;
    
    if (address && isConnected) {
      fetchContracts();
    }
  }, [address, isConnected, networkState, fetchContracts]); // Added fetchContracts to dependency array

  // Create a stable refresh function
  const refreshContracts = useCallback(async () => {
    await fetchContracts();
  }, [fetchContracts]);

  // Create a stable context value to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    contracts,
    isLoading,
    error,
    refreshContracts,
    network: networkRef.current
  }), [contracts, isLoading, error, refreshContracts]);
  
  return (
    <ContractsContext.Provider value={contextValue}>
      {children}
    </ContractsContext.Provider>
  );
}

export function useContracts() {
  return useContext(ContractsContext);
}

export default ContractsProvider; 