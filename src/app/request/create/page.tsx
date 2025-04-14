/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import RequestPaymentForm from '@/components/payments/RequestPaymentForm';
import { ConnectWallet } from '@/components/ui/connect-wallet';

export default function CreateRequestPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const [loading, setLoading] = useState(false);
  
  const handleSuccess = () => {
    router.push('/dashboard');
  };
  
  return (
    <div className="container max-w-2xl mx-auto pt-8 px-4 pb-16">
      <Button 
        variant="outline" 
        className="mb-4" 
        onClick={() => router.push('/dashboard')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Create Payment Request</CardTitle>
          <CardDescription>
            Create a payment request to receive PYUSD from others
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isConnected ? (
            <RequestPaymentForm
              userAddress={address}
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="text-center py-8">
              <p className="mb-4 text-gray-500">Please connect your wallet to create payment requests</p>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  open();
                }}
              >
                Connect Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 