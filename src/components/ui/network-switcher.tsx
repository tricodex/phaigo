'use client';

import { useState, useEffect } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { gcpBlockchainRpcChain } from "@/config/wagmi";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NetworkSwitcher() {
  const chainId = useChainId();
  const { switchChain, error, isPending } = useSwitchChain();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(null);
  
  // Get the target chain ID from the GCP chain config
  // Using sepolia by default for development
  const targetChain = gcpBlockchainRpcChain.sepolia;
  const targetChainId = targetChain.id;
  
  // Check if the network is available by pinging it
  useEffect(() => {
    const checkNetworkAvailability = async () => {
      try {
        // Try to fetch the chain ID from the RPC
        const response = await fetch('/api/rpc-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'eth_chainId',
            params: []
          }),
        });
        
        if (!response.ok) {
          console.error('Network check failed - HTTP error:', response.status);
          setNetworkAvailable(false);
          return;
        }
        
        const data = await response.json();
        if (data.error) {
          console.error('Network check failed - RPC error:', data.error);
          setNetworkAvailable(false);
        } else {
          console.log('Network check succeeded:', data.result);
          setNetworkAvailable(true);
        }
      } catch (err) {
        console.error('Network availability check failed:', err);
        setNetworkAvailable(false);
      }
    };
    
    if (mounted && typeof chainId !== 'undefined' && chainId !== targetChainId) {
      checkNetworkAvailability();
    }
  }, [mounted, chainId, targetChainId]);
  
  // Set mounted after hydration to avoid SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error('Network switching error:', error);
    }
  }, [error]);
  
  // Safely determine if we're on the correct network
  const isCorrectNetwork = mounted && typeof chainId !== 'undefined' && chainId === targetChainId;
  
  const handleSwitchNetwork = async () => {
    try {
      if (!switchChain) {
        console.error('switchChain function not available');
        toast({
          title: "Network switching unavailable",
          description: "Please add the network manually in your wallet",
          variant: "destructive",
        });
        showNetworkDetails();
        return;
      }
      
      if (networkAvailable === false) {
        toast({
          title: "Network unavailable",
          description: "The GCP Blockchain RPC service appears to be offline. Please try again later or contact support.",
          variant: "destructive",
        });
        showNetworkDetails();
        return;
      }
      
      await switchChain({ chainId: targetChainId });
      toast({
        title: "Network switched",
        description: `Switched to ${targetChain.name}`,
      });
    } catch (err) {
      console.error('Failed to switch network:', err);
      toast({
        title: "Failed to switch network",
        description: "Please add the network manually in your wallet",
        variant: "destructive",
      });
      
      showNetworkDetails();
    }
  };
  
  // Helper function to show network details
  const showNetworkDetails = () => {
    toast({
      title: "Add Network Manually",
      description: `Network Name: ${targetChain.name}
RPC URL: ${targetChain.rpcUrls.default.http[0]}
Chain ID: ${targetChainId} (0x${targetChainId.toString(16)})
Currency Symbol: ${targetChain.nativeCurrency.symbol}`,
      duration: 10000,
    });
  };
  
  // Don't render anything until component is mounted or if already on correct network
  if (!mounted || isCorrectNetwork || typeof chainId === 'undefined') return null;
  
  // If network availability check failed, show a warning
  if (networkAvailable === false) {
    return (
      <div className="space-y-2">
        <Alert variant="destructive" className="text-xs py-2">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <AlertDescription>
            GCP Blockchain RPC service appears to be offline
          </AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={showNetworkDetails}
          className="text-xs w-full"
        >
          View Network Details
        </Button>
      </div>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleSwitchNetwork}
      disabled={isPending}
      className="text-xs"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          Switching...
        </>
      ) : (
        <>Switch to {targetChain.name}</>
      )}
    </Button>
  );
} 