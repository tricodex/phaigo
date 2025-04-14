// Connect Wallet component with additional debugging for connection issues
'use client';

import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';
import { Wallet, LogOut } from 'lucide-react';

// Local utility function
const shortenAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function ConnectWallet({ 
  size = 'default', 
  showAddress = false,
  className = '' 
}: { 
  size?: 'default' | 'sm' | 'lg', 
  showAddress?: boolean,
  className?: string 
}) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open, close } = useWeb3Modal();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);

  // Only show wallet UI after component mounts to avoid hydration errors
  useEffect(() => {
    setMounted(true);
    console.log('ConnectWallet mounted - isConnected:', isConnected);
    console.log('ConnectWallet - address:', address);
    console.log('ConnectWallet - chainId:', chainId);
  }, [isConnected, address, chainId]);

  // Don't render anything until component is mounted
  if (!mounted) return null;

  if (!isConnected || !address) {
    return (
      <Button
        variant="default"
        size={size}
        className={`${className} flex items-center gap-2`}
        onClick={() => {
          console.log('Opening Web3Modal for connection');
          try {
            open();
          } catch (err) {
            console.error('Error opening Web3Modal:', err);
          }
        }}
      >
        <Wallet className="h-4 w-4" />
        <span>Connect Wallet</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showAddress && (
        <span className="text-sm font-medium">{shortenAddress(address)}</span>
      )}
      <Button
        variant="outline"
        size={size}
        className={className}
        onClick={() => {
          // Toggle between showing account details and disconnecting
          if (window.confirm('Do you want to disconnect your wallet?')) {
            disconnect();
            close();
          }
        }}
      >
        <LogOut className="h-4 w-4 mr-2" />
        {showAddress ? 'Disconnect' : shortenAddress(address)}
      </Button>
    </div>
  );
} 