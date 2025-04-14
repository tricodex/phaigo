"use client";

import { useState, useEffect } from 'react';
import { Network } from '@/types/network';
import { getNetworkChainId } from '@/types/network';
import { gcpBlockchainRpcChain } from '@/config/wagmi';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface NetworkStatusProps {
  currentNetwork: Network;
  onNetworkChange?: (network: Network) => void;
}

export function NetworkStatus({ currentNetwork, onNetworkChange }: NetworkStatusProps) {
  const [network, setNetwork] = useState<Network>(currentNetwork);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    const checkNetwork = async () => {
      if (typeof window.ethereum === 'undefined') return;
      
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const chainIdNumber = typeof chainId === 'string' ? parseInt(chainId, 16) : null;
        if (chainIdNumber) {
          const expectedChainId = getNetworkChainId(network);
          
          // Check if user is on the expected network
          if (chainIdNumber !== expectedChainId) {
            setIsCorrectNetwork(false);
          } else {
            setIsCorrectNetwork(true);
          }
        }
      } catch (error) {
        console.error('Error checking network:', error);
      }
    };
    
    checkNetwork();
    
    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', checkNetwork);
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkNetwork);
      }
    };
  }, [network]);
  
  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork);
    if (onNetworkChange) {
      onNetworkChange(newNetwork);
    }
  };
  
  const switchNetwork = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast({
        title: "MetaMask not installed",
        description: "Please install MetaMask to switch networks",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSwitching(true);
      
      // Get the chain ID for the current network
      const targetChainId = getNetworkChainId(network);
      // Convert to hex
      const hexChainId = `0x${targetChainId.toString(16)}`;
      
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }]
      });
      
      setIsCorrectNetwork(true);
      toast({
        title: "Network switched",
        description: `Successfully switched to ${network}`
      });
    } catch (error: unknown) {
      // If error code 4902, the chain is not added to MetaMask
      if (error && typeof error === 'object' && 'code' in error && error.code === 4902) {
        try {
          // For network chains
          if (network === 'mainnet' || network === 'sepolia') {
            // Add the network to wallet
            const chainId = getNetworkChainId(network);
            const hexChainId = `0x${chainId.toString(16)}`;
            const networkName = network === 'mainnet' ? 'Ethereum Mainnet' : 'Sepolia Testnet';
            
            // Get RPC URLs from gcpBlockchainRpcChain config
            const chainConfig = gcpBlockchainRpcChain[network];
            const rpcUrl = chainConfig.rpcUrls.default.http[0];
            const explorerUrl = network === 'mainnet' 
              ? 'https://etherscan.io' 
              : 'https://sepolia.etherscan.io';
            
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: hexChainId,
                  chainName: networkName,
                  nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: [rpcUrl],
                  blockExplorerUrls: [explorerUrl]
                }
              ]
            });
            
            toast({
              title: "Network added",
              description: `Successfully added ${networkName}`
            });
          } else {
            throw new Error("Unknown network");
          }
        } catch (addError) {
          console.error("Error adding chain:", addError);
          toast({
            title: "Failed to add network",
            description: "Please add the network manually in your wallet",
            variant: "destructive"
          });
        }
      } else {
        console.error("Error switching chain:", error);
        toast({
          title: "Failed to switch network",
          description: "Please switch networks manually in your wallet",
          variant: "destructive"
        });
      }
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`w-3 h-3 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span className="font-medium capitalize">{network}</span>
      
      {!isCorrectNetwork && (
        <button 
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded flex items-center"
          onClick={switchNetwork}
          disabled={isSwitching}
        >
          {isSwitching ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Switching...
            </>
          ) : (
            "Switch"
          )}
        </button>
      )}
      
      <div className="ml-2">
        <select 
          title="Network"
          name="network"
          value={network}
          onChange={(e) => handleNetworkChange(e.target.value as Network)}
          className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1"
        >
          <option value="mainnet">Mainnet</option>
          <option value="sepolia">Sepolia</option>
        </select>
      </div>
    </div>
  );
}

export default NetworkStatus;