'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/ui/use-toast';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { RefreshCw, ArrowLeft, CheckCircle, Clock, XCircle, Copy, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Separator } from '@/components/ui/separator';
import { QRCodeSVG } from 'qrcode.react';

interface FulfilledBy {
  id: string;
  transactionHash: string | null;
  status: string;
  sender: {
    username: string;
    displayName: string | null;
  };
  recipient: {
    username: string;
    displayName: string | null;
  };
}

interface RequestData {
  id: string;
  amount: string;
  notes: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string | null;
  user: {
    username: string;
    displayName: string | null;
    walletAddress: string;
  };
  fulfilledBy: FulfilledBy | null;
}

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { open } = useWeb3Modal();
  
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Fetch request data
  useEffect(() => {
    const fetchRequest = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/requests/${id}`);
        const data = await response.json();
        
        if (response.ok) {
          console.log('Request data:', data);
          setRequestData(data.request);
        } else {
          setError(data.error || 'Failed to load request');
          toast({
            title: 'Error',
            description: data.error || 'Failed to load request',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Error fetching request:', err);
        setError('An error occurred while fetching the request');
        toast({
          title: 'Error',
          description: 'An error occurred while fetching the request',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchRequest();
    }
  }, [id, toast]);
  
  // Fulfill payment request
  const fulfillRequest = async () => {
    try {
      // First check if we're connected to a wallet
      if (!isConnected) {
        // If not connected, open the wallet connection modal and stop here
        open();
        return;
      }

      if (!requestData || !address) return;
      
      setFulfilling(true);

      // Only after ensuring wallet is connected, check if request is still available
      const checkResponse = await fetch(`/api/requests/${id}`);
      const checkData = await checkResponse.json();
      
      if (!checkResponse.ok || checkData.request.status !== 'OPEN') {
        toast({
          title: 'Request Unavailable',
          description: 'This payment request is no longer available or has already been paid',
          variant: 'destructive',
        });
        setFulfilling(false);
        router.refresh();
        return;
      }

      // First get the recipient's wallet address and payment details from the API
      const prepareResponse = await fetch('/api/payments/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: requestData.amount,
          recipientUsername: requestData.user.username,
          requestId: requestData.id,
          notes: `Fulfilling payment request from ${requestData.user.username}`,
        }),
      });
      
      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        toast({
          title: 'Preparation Failed',
          description: errorData.error || 'Failed to prepare payment',
          variant: 'destructive',
        });
        setFulfilling(false);
        return;
      }
      
      const prepareData = await prepareResponse.json();
      
      // Now we have the recipient's wallet address, create the payment transaction
      // This will trigger the wallet UI to open
      try {
        // Check if ethereum provider is available in window
        if (!window.ethereum) {
          throw new Error('No ethereum wallet extension detected. Please install a wallet like MetaMask.');
        }

        // This will show the wallet UI for transaction confirmation
        const txResponse = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: prepareData.recipientAddress,
            value: '0x0', // 0 ETH since we're sending PYUSD token
            data: prepareData.transactionData, // The encoded token transfer
          }]
        });
        
        if (txResponse) {
          // Transaction was signed and submitted - record it in our system
          const updateResponse = await fetch('/api/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Wallet ${address}`,
            },
            body: JSON.stringify({
              amount: requestData.amount,
              recipientUsername: requestData.user.username,
              requestId: requestData.id,
              notes: `Fulfilling payment request from ${requestData.user.username}`,
              transactionHash: txResponse,
            }),
          });
          
          const updateData = await updateResponse.json();
          
          if (updateResponse.ok) {
            // Now explicitly update the transaction hash and trigger verification
            await fetch(`/api/payments/check-stale?txHash=${txResponse}`, {
              method: 'GET',
              headers: {
                'Authorization': `Wallet ${address}`,
              },
            });

            toast({
              title: 'Payment Submitted',
              description: 'Your transaction is being processed',
            });
            
            // Now poll for status
            let attempts = 0;
            const maxAttempts = 15;
            const checkPaymentStatus = async () => {
              if (attempts >= maxAttempts) {
                toast({
                  title: 'Payment Pending',
                  description: 'Your payment is still being processed. You can check status on the dashboard.',
                });
                
                // Instead of redirecting, offer a retry button
                setFulfilling(false);
                router.refresh();
                return;
              }
              
              try {
                // First check directly by payment ID
                const statusResponse = await fetch(`/api/payments/${updateData.payment.id}`);
                const statusData = await statusResponse.json();
                
                if (statusResponse.ok) {
                  if (statusData.payment.status === 'COMPLETED') {
                    toast({
                      title: 'Payment Successful',
                      description: 'Your payment has been completed successfully',
                    });
                    router.push('/dashboard');
                    return;
                  } else if (statusData.payment.status === 'FAILED') {
                    toast({
                      title: 'Payment Failed',
                      description: statusData.payment.syncError || 'Transaction was not confirmed',
                      variant: 'destructive',
                    });
                    setFulfilling(false);
                    router.refresh();
                    return;
                  } else {
                    // Still pending, try to force verification with check-stale API on the last few attempts
                    if (attempts > maxAttempts - 5) {
                      try {
                        // Try to force check the transaction status
                        const verifyResponse = await fetch(`/api/payments/check-stale?txHash=${txResponse}`);
                        if (verifyResponse.ok) {
                          const verifyData = await verifyResponse.json();
                          
                          // If verification was successful, check again after short delay
                          if (verifyData.wasFixed) {
                            setTimeout(checkPaymentStatus, 1000);
                            return;
                          }
                        }
                      } catch (verifyError) {
                        console.error('Error during verification:', verifyError);
                        // Continue with regular polling even if verification fails
                      }
                    }
                    
                    // Still pending, check again after delay
                    attempts++;
                    setTimeout(checkPaymentStatus, 2000);
                  }
                } else {
                  setFulfilling(false);
                  toast({
                    title: 'Status Check Failed',
                    description: 'Unable to verify payment status',
                    variant: 'destructive',
                  });
                }
              } catch (error) {
                console.error('Error checking payment status:', error);
                setFulfilling(false);
                toast({
                  title: 'Status Check Error',
                  description: 'An error occurred while checking payment status',
                  variant: 'destructive',
                });
              }
            };
            
            // Start polling after a short delay
            setTimeout(checkPaymentStatus, 3000);
          } else {
            setFulfilling(false);
            toast({
              title: 'Payment Recording Failed',
              description: updateData.error || 'Failed to record payment',
              variant: 'destructive',
            });
          }
        } else {
          setFulfilling(false);
          toast({
            title: 'Transaction Cancelled',
            description: 'You cancelled the transaction in your wallet',
            variant: 'destructive',
          });
        }
      } catch (walletError) {
        console.error('Wallet interaction error:', walletError);
        setFulfilling(false);
        toast({
          title: 'Wallet Error',
          description: 'Unable to interact with your wallet. Please make sure it is unlocked and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fulfilling request:', error);
      setFulfilling(false);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while processing your payment',
        variant: 'destructive',
      });
    }
  };
  
  // Get status text and color
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
      'OPEN': { 
        text: 'Open', 
        color: 'text-blue-600', 
        icon: <Clock className="h-5 w-5 text-blue-600" /> 
      },
      'IN_PROGRESS': { 
        text: 'Payment in Progress', 
        color: 'text-amber-600',
        icon: <RefreshCw className="h-5 w-5 text-amber-600" />
      },
      'FULFILLED': { 
        text: 'Fulfilled', 
        color: 'text-green-600',
        icon: <CheckCircle className="h-5 w-5 text-green-600" />
      },
      'CANCELED': { 
        text: 'Canceled', 
        color: 'text-red-600',
        icon: <XCircle className="h-5 w-5 text-red-600" />
      },
      'EXPIRED': { 
        text: 'Expired', 
        color: 'text-gray-600',
        icon: <XCircle className="h-5 w-5 text-gray-600" />
      },
    };
    
    return statusMap[status] || { text: status, color: 'text-gray-600', icon: null };
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP p');
    } catch {
      return 'Invalid date';
    }
  };
  
  // Function to copy share link to clipboard
  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/request/${id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        toast({
          title: 'Link Copied',
          description: 'Payment request link copied to clipboard',
        });
        
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        toast({
          title: 'Copy Failed',
          description: 'Failed to copy link to clipboard',
          variant: 'destructive',
        });
      });
  };
  
  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto pt-8 px-4">
        <div className="flex justify-center items-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }
  
  if (error || !requestData) {
    return (
      <div className="container max-w-2xl mx-auto pt-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Request Not Found</CardTitle>
            <CardDescription>
              The payment request you&apos;re looking for doesn&apos;t exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const statusInfo = getStatusInfo(requestData.status);
  const isOpen = requestData.status === 'OPEN';
  const isMyRequest = address?.toLowerCase() === requestData.user.walletAddress.toLowerCase();
  
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Request</CardTitle>
              <CardDescription>
                {`From ${requestData.user.displayName || requestData.user.username}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {statusInfo.icon}
              <span className={`font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex justify-between items-center py-3 px-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Amount</span>
            <div className="flex items-center">
              <PyusdIcon className="mr-2" size={20} />
              <span className="text-2xl font-bold">{requestData.amount}</span>
              <span className="ml-2 text-gray-500">PYUSD</span>
            </div>
          </div>
          
          {requestData.notes && (
            <div>
              <h3 className="text-sm font-medium mb-2">Notes</h3>
              <p className="text-gray-600 bg-muted/30 p-3 rounded-md">
                {requestData.notes}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Details</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-500">Created</span>
              <span>{formatDate(requestData.createdAt)}</span>
              
              {requestData.expiresAt && (
                <>
                  <span className="text-gray-500">Expires</span>
                  <span>{formatDate(requestData.expiresAt)}</span>
                </>
              )}
              
              <span className="text-gray-500">Request ID</span>
              <span className="truncate">{requestData.id}</span>
            </div>
          </div>
          
          {/* QR Code section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Share Request</h3>
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg mb-3">
                <QRCodeSVG
                  value={`${window.location.origin}/request/${id}`}
                  size={180}
                  bgColor={'#FFFFFF'}
                  fgColor={'#000000'}
                  level={'L'}
                  includeMargin={false}
                />
              </div>
              
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 p-3 bg-muted rounded-lg text-sm font-medium truncate">
                  {`${window.location.origin}/request/${id}`}
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyShareLink}
                  className="flex-shrink-0"
                >
                  {isCopied ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <Copy className="h-4 w-4" />
                  }
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: "PYUSD Payment Request",
                        text: `Please pay ${requestData.amount} PYUSD`,
                        url: `${window.location.origin}/request/${id}`
                      }).catch(err => console.error("Share failed:", err));
                    } else {
                      copyShareLink();
                    }
                  }}
                  className="flex-shrink-0"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {isOpen && !isMyRequest ? (
            <Button
              onClick={fulfillRequest}
              disabled={fulfilling}
              className="w-full"
            >
              {fulfilling ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Pay Request</>
              )}
            </Button>
          ) : isMyRequest ? (
            <div className="text-center text-sm text-gray-500">
              This is your payment request.
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">
              This request is {requestData.status.toLowerCase()} and cannot be paid.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 