'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Network } from '@/types/network';
import { formatDistanceToNow } from 'date-fns';

import { useToast } from '@/components/ui/use-toast';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import { User, Payment } from '@prisma/client';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface TransactionWithUsers extends Payment {
  sender: User;
  recipient: User;
  type: 'sent' | 'received';
}

interface TransactionHistoryProps {
  address?: string;
  network: Network;
  limit?: number;
}

// We're keeping network in the interface for backward compatibility
// but not using it in the implementation
const TransactionHistory = ({ address, network = 'sepolia' }: TransactionHistoryProps) => {
  const { address: wagmiAddress } = useAccount();
  const [transactions, setTransactions] = useState<TransactionWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Use the provided address or fall back to wagmiAddress
  // This helps with displaying transaction history even when wallet is disconnected
  const effectiveAddress = address || wagmiAddress || localStorage.getItem('lastConnectedWallet');
  
  // Store the last connected wallet address for persistence
  useEffect(() => {
    if (wagmiAddress) {
      localStorage.setItem('lastConnectedWallet', wagmiAddress);
    }
  }, [wagmiAddress]);

  const fetchTransactions = useCallback(async () => {
    if (!effectiveAddress) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/payments?walletAddress=${effectiveAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }
      
      const data = await response.json();
      
      const enhancedTransactions = data.payments.map((payment: Payment & { sender: User; recipient: User }) => ({
        ...payment,
        type: payment.sender.walletAddress.toLowerCase() === effectiveAddress.toLowerCase() ? 'sent' : 'received'
      }));
      
      setTransactions(enhancedTransactions);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveAddress]);

  const handleRefresh = async () => {
    if (refreshing) return;
    
    try {
      setRefreshing(true);
      await fetchTransactions();
      toast({
        title: 'Refreshed',
        description: 'Transaction history has been updated',
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [effectiveAddress, fetchTransactions]);

  const getTransactionDetails = (transaction: TransactionWithUsers) => {
    const isSent = transaction.type === 'sent';
    const counterparty = isSent ? transaction.recipient : transaction.sender;
    const prefix = isSent ? '-' : '+';
    
    return {
      prefix,
      amount: transaction.amount,
      username: counterparty.username,
      displayName: counterparty.displayName || counterparty.username,
      date: formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true }),
      status: transaction.status,
      txHash: transaction.transactionHash || undefined,
      notes: transaction.notes || '-'
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">Processing...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Add a function to retry verification for pending transactions
  const retryVerification = async (txHash: string, onSuccess?: () => void) => {
    if (!txHash) return;
    
    try {
      toast({
        title: 'Verifying Transaction',
        description: 'Checking blockchain for confirmation status...',
      });
      
      const response = await fetch(`/api/payments/check-stale?txHash=${txHash}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Retry verification response:', data);
        
        if (data.wasFixed) {
          toast({
            title: 'Verification Successful',
            description: 'Transaction has been verified and marked as completed.',
          });
          
          // Refresh data if a callback was provided
          if (onSuccess) {
            onSuccess();
          }
        } else {
          // Even if we couldn't verify, check the blockchain explorer to give the user info
          const explorerUrl = getExplorerLink(txHash);
          
          toast({
            title: 'Verification Pending',
            description: (
              <>
                The transaction is still being processed on the blockchain. 
                You can check its status on <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Etherscan</a>.
              </>
            ),
          });
        }
      } else {
        toast({
          title: 'Verification Failed',
          description: 'Unable to verify the transaction. Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error retrying verification:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  // Generate explorer link based on network and transaction hash
  const getExplorerLink = (txHash?: string) => {
    if (!txHash) return '';
    
    const baseUrl = network === 'mainnet' 
      ? 'https://etherscan.io/tx/' 
      : 'https://sepolia.etherscan.io/tx/';
    
    return `${baseUrl}${txHash}`;
  };

  // Render details with appropriate truncation and tooltip/dialog for viewing full text
  const renderTransactionDetails = (notes: string) => {
    if (!notes || notes === '-') return '-';
    
    const maxLength = 20; // Shorter truncation length for mobile-friendly view
    const truncatedText = notes.length > maxLength 
      ? `${notes.substring(0, maxLength)}...` 
      : notes;
      
    // For desktop: Use tooltip on hover
    // For mobile: Use dialog on click (since hover isn't reliable on touch devices)
    return (
      <div className="flex items-center">
        {/* Desktop tooltip */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden md:inline cursor-help truncate max-w-[120px]">
                {truncatedText}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm" side="top">
              <p className="break-words">{notes}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Mobile dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <span className="md:hidden cursor-pointer truncate max-w-[120px] inline-block">
              {truncatedText}
            </span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <div className="space-y-2">
              <h4 className="font-medium">Transaction Details</h4>
              <p className="text-sm break-words">{notes}</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="text-center py-4">Loading transactions...</div>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent transactions and payment requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">No transactions yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent transactions and payment requests</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map(transaction => {
            const details = getTransactionDetails(transaction);
            const explorerLink = getExplorerLink(details.txHash);
            const isPending = details.status === 'PENDING';
            
            return (
              <div key={transaction.id} className="flex flex-col space-y-2 p-4 border rounded-lg bg-card">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className={`mr-3 text-lg font-semibold ${details.prefix === '+' ? 'text-green-600' : 'text-red-600'}`}>
                      <span>{details.prefix}</span>
                      <span>{details.amount}</span>
                                            <PyusdIcon className="inline mx-1" size={16} />

                    </div>
                    {getStatusBadge(details.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">{details.date}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    {/* <div className="text-muted-foreground">User</div> */}
                    <div>@{details.username}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Notes</div>
                    <div>{renderTransactionDetails(details.notes)}</div>
                  </div>
                  <div className="flex justify-end items-end gap-2">
                    {isPending && details.txHash && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => retryVerification(details.txHash || '', fetchTransactions)}
                        className="h-8 px-2 text-xs"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Retry verification
                      </Button>
                    )}
                    
                    {explorerLink && (
                      <a 
                        href={explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-8 px-2 text-xs rounded-md border border-input hover:bg-accent hover:text-accent-foreground"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        View on Etherscan
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
