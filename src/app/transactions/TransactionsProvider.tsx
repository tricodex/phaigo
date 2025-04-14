"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { PyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import type { Network } from '@/types/network';

interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  direction: 'in' | 'out';
}

interface TransactionsContextType {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  refreshTransactions: () => Promise<void>;
  network: Network;
}

// Default network
const DEFAULT_NETWORK: Network = 'sepolia';

// Create default context
const TransactionsContext = createContext<TransactionsContextType>({
  transactions: [],
  isLoading: false,
  error: null,
  refreshTransactions: async () => {},
  network: DEFAULT_NETWORK
});

// Create token service instance outside component
const pyusdService = new PyusdTokenService();

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // Use refs to avoid render-phase updates
  const addressRef = useRef(address);
  const networkRef = useRef<Network>(DEFAULT_NETWORK);
  const hasMountedRef = useRef(false);
  
  // Actual state for UI
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  
  // Create a stable fetch function with useCallback to avoid recreation
  const fetchTransactions = useCallback(async () => {
    if (!addressRef.current || !isConnected) {
      setTransactions([]);
      return;
    }
    
    try {
      setIsLoading(true);
      const txHistory = await pyusdService.getTransactionHistory(
        addressRef.current, 
        networkRef.current
      );
      
      // Process transactions for display
      const processedTxs: Transaction[] = txHistory.map(tx => ({
        hash: tx.txHash,
        timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
        from: tx.from,
        to: tx.to,
        value: pyusdService.formatPyusd(tx.amount, networkRef.current),
        direction: tx.to.toLowerCase() === addressRef.current?.toLowerCase() ? 'in' : 'out'
      }));
      
      setTransactions(processedTxs);
    } catch (err) {
      console.error('Error fetching transaction history:', err);
      setError(err instanceof Error ? err : new Error('Failed to load transaction history'));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]); // Only depends on isConnected since other dependencies are refs

  // Only fetch transactions when we're connected and have an address
  // Use the hasMountedRef to avoid hydration mismatches
  useEffect(() => {
    // Avoid fetch during SSR
    if (!hasMountedRef.current) return;
    
    if (address && isConnected) {
      fetchTransactions();
    }
  }, [address, isConnected, networkState, fetchTransactions]); // Added fetchTransactions to dependencies

  // Create a stable refresh function using our useCallback function
  const refreshTransactions = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  // Create a stable context value to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    transactions,
    isLoading,
    error,
    refreshTransactions,
    network: networkRef.current
  }), [transactions, isLoading, error, refreshTransactions]);

  return (
    <TransactionsContext.Provider value={contextValue}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  return useContext(TransactionsContext);
}

export default TransactionsProvider;