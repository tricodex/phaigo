'use client';

import { useState, useEffect, useCallback } from 'react';
import { pyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import { Network } from '@/types/network';
import { RefreshCw } from 'lucide-react';
import PyusdIcon from '@/components/ui/pyusd-icon';

interface PyusdBalanceProps {
  address: string | undefined;
  network: Network;
  className?: string;
}

const PyusdBalance = ({ address, network, className = '' }: PyusdBalanceProps) => {
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const formattedBalance = await pyusdTokenService.getFormattedBalance(address, network);
      setBalance(formattedBalance);
    } catch (error) {
      console.error('Error fetching PYUSD balance:', error);
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  const handleRefresh = async () => {
    if (refreshing || !address) return;
    
    try {
      setRefreshing(true);
      await fetchBalance();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    
    // Set up event listener for balance changes
    const cleanup = pyusdTokenService.monitorBalance(
      address || '',
      (newBalance) => {
        const formatted = pyusdTokenService.formatPyusd(newBalance, network);
        setBalance(formatted);
      },
      network
    );
    
    return cleanup;
  }, [address, fetchBalance, network]);

  if (!address) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center">
        <PyusdIcon className="mr-1" size={20} />
        <div>
          <div className="font-medium">
            {loading ? (
              <span className="inline-block w-16 h-6 bg-gray-200 animate-pulse rounded"></span>
            ) : (
              <span>{balance} <span className="text-sm">PYUSD</span></span>
            )}
          </div>
          <p className="text-xs text-gray-500">Available Balance</p>
        </div>
      </div>
      <button 
        title="Refresh Balance"
        onClick={handleRefresh}
        disabled={refreshing}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <RefreshCw 
          className={`h-4 w-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} 
        />
      </button>
    </div>
  );
};

export default PyusdBalance;
