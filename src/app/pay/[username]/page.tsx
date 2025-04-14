'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConnectWallet } from '@/components/ui/connect-wallet';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { Network } from '@/types/network';
import { PageWrapper } from "@/components/layouts/PageWrapper";
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { Send, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import PyusdBalance from '@/components/payments/PyusdBalance';
import { pyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import Image from 'next/image';
import { ethers } from 'ethers';
import { PublicUserProfile } from '@/types/user';
import PyusdIcon from '@/components/ui/pyusd-icon';

export default function PaymentPage() {
  return (
    <PageWrapper>
      <PaymentPageContent />
    </PageWrapper>
  );
}

function PaymentPageContent() {
  const { username } = useParams<{ username: string }>();
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<Network>('sepolia');
  const [recipient, setRecipient] = useState<PublicUserProfile | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    notes: '',
  });

  // Fetch recipient profile
  useEffect(() => {
    const fetchRecipientProfile = async () => {
      if (!username) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${username}`);
        
        if (response.ok) {
          const data = await response.json();
          setRecipient(data.user);
        } else {
          toast({
            title: 'User Not Found',
            description: `No user found with username: ${username}`,
            variant: 'destructive',
          });
          // Redirect to home after showing error
          setTimeout(() => router.push('/'), 3000);
        }
      } catch (error) {
        console.error('Error fetching recipient profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load recipient profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecipientProfile();
  }, [username, toast, router]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // For amount, only allow numbers and one decimal point
    if (name === 'amount') {
      // Prevent more than one decimal point
      if (value.split('.').length > 2) return;
      
      // Ensure it's a valid number
      if (value && !/^\d*\.?\d*$/.test(value)) return;
      
      // Limit to 6 decimal places (PYUSD precision)
      const parts = value.split('.');
      if (parts[1] && parts[1].length > 6) return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle payment submission
  const handleSubmitPayment = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to send a payment',
        variant: 'destructive',
      });
      return;
    }
    
    if (!recipient) {
      toast({
        title: 'Recipient Error',
        description: 'Cannot find recipient information',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setSending(true);
      
      // First check if user has enough balance
      const balance = await pyusdTokenService.getBalance(address, currentNetwork);
      const amountBigInt = pyusdTokenService.parsePyusd(formData.amount, currentNetwork);
      
      if (balance < amountBigInt) {
        toast({
          title: 'Insufficient Balance',
          description: 'You do not have enough PYUSD to complete this payment',
          variant: 'destructive',
        });
        setSending(false);
        return;
      }
      
      // Create payment through the service/API
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${address}`,
        },
        body: JSON.stringify({
          recipientUsername: recipient.username,
          amount: formData.amount,
          notes: formData.notes,
        }),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Payment Initiated',
          description: `You're sending ${formData.amount} PYUSD to @${recipient.username}`,
        });
        
        // Next step: Handle blockchain transaction
        try {
          // Check if window.ethereum is available
          if (typeof window === 'undefined' || !window.ethereum) {
            throw new Error('MetaMask or other Ethereum wallet is not available');
          }
          
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.BrowserProvider(window.ethereum);
          const userSigner = await provider.getSigner();
          
          const tx = await pyusdTokenService.transfer(
            recipient.walletAddress,
            formData.amount,
            userSigner,
            currentNetwork
          );
          
          toast({
            title: 'Transaction Sent',
            description: 'Your payment is being processed on the blockchain',
          });
          
          // Wait for transaction confirmation
          const receipt = await tx.wait();
          
          // Update payment record with transaction hash
          await fetch(`/api/payments/${responseData.payment.id}/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Wallet ${address}`,
            },
            body: JSON.stringify({
              transactionHash: receipt?.hash || tx.hash,
            }),
          });
          
          toast({
            title: 'Payment Complete',
            description: `Successfully sent ${formData.amount} PYUSD to @${recipient.username}`,
          });
          
          // Reset form
          setFormData({
            amount: '',
            notes: '',
          });
          
          // Redirect to dashboard
          router.push('/dashboard');
        } catch (error) {
          console.error('Error during blockchain transaction:', error);
          toast({
            title: 'Transaction Failed',
            description: 'There was an error processing your transaction',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Payment Failed',
          description: responseData.error || 'Failed to initiate payment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending payment:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b py-4 sticky top-0 bg-white z-10">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

            <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
          </div>
          <div className="flex items-center gap-3">
            <NetworkStatus currentNetwork={currentNetwork} onNetworkChange={setCurrentNetwork} />
            <ConnectWallet size="sm" showAddress={true} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Back to Dashboard</span>
          </Link>
          
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white animate-pulse">
                <RefreshCw className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Loading recipient information...</p>
            </div>
          ) : recipient ? (
            <Card className="shadow-lg border-blue-100">
              <CardHeader className="text-center pb-0">
                <div className="mb-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                    {recipient.displayName?.[0]?.toUpperCase() || recipient.username[0].toUpperCase()}
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">
                  Send PYUSD to {recipient.displayName || recipient.username}
                </CardTitle>
                <CardDescription>@{recipient.username}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {isConnected && address && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Your PYUSD Balance</p>
                    <PyusdBalance address={address} network={currentNetwork} />
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium">
                      Amount (PYUSD)
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <PyusdIcon size={18} />
                      </div>
                      <Input
                        id="amount"
                        name="amount"
                        placeholder="0.00"
                        className="pl-9"
                        value={formData.amount}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Notes (optional)
                    </label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="What's this payment for?"
                      rows={3}
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {isConnected ? (
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    onClick={handleSubmitPayment}
                    disabled={sending || !formData.amount}
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Payment
                      </>
                    )}
                  </Button>
                ) : (
                  <ConnectWallet size="lg" className="w-full" />
                )}
              </CardFooter>
            </Card>
          ) : (
            <Card className="shadow-lg border-red-100">
              <CardHeader>
                <CardTitle className="text-red-600">User Not Found</CardTitle>
                <CardDescription>
                  We couldn&apos;t find a user with the username: {username}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>The user you&apos;re trying to pay doesn&apos;t exist or has changed their username.</p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => router.push('/')}
                >
                  Return Home 
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <span className="logo-text text-gray-800 text-lg">phaigo</span>
            </div>
            
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} Phaigo - Powered by <a href="https://www.pyusd.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PYUSD</a>
            </p>
          </div>
        </div>
      </footer>
      
      <Toaster />
    </div>
  );
}
