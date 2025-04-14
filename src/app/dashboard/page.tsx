/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectWallet } from '@/components/ui/connect-wallet';
import { Separator } from '@/components/ui/separator';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { Network } from '@/types/network';
import { PageWrapper } from '@/components/layouts/PageWrapper';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, Copy, Users, Wallet, Clock, Send, DollarSign, RefreshCw, PlusCircle, User, QrCode, ChevronRight, CirclePlus, ArrowUpRight, ArrowDownLeft, BarChart } from 'lucide-react';
import Image from 'next/image';
import PyusdBalance from '@/components/payments/PyusdBalance';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { User as UserType } from '@/types/user';
import Link from 'next/link';
import { Header } from '@/components/layouts/Header';

// Components to build the dashboard
import SendPaymentForm from '@/components/payments/SendPaymentForm';
import RequestPaymentForm from '@/components/payments/RequestPaymentForm';
import TransactionHistory from '@/components/payments/TransactionHistory';

// Add RequestOverview component
interface RequestItem {
  id: string;
  amount: string;
  user: {
    username: string;
    displayName: string | null;
  };
  status: string;
  createdAt: string;
}

function RequestOverview() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  useEffect(() => {
    const fetchRequests = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/requests?walletAddress=${address}`);
        const data = await response.json();
        
        if (response.ok) {
          // Filter to only show open requests first, then limit to 3
          const sortedRequests = data.requests
            .sort((a: RequestItem, b: RequestItem) => {
              // First by status (OPEN first)
              if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
              if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
              // Then by creation date (newest first)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .slice(0, 3);
          
          setRequests(sortedRequests);
        } else {
          console.error('Failed to fetch requests:', data);
        }
      } catch (error) {
        console.error('Error fetching requests:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (isConnected) {
      fetchRequests();
    } else {
      setRequests([]);
      setLoading(false);
    }
  }, [address, isConnected]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'OPEN': 'text-blue-600',
      'IN_PROGRESS': 'text-amber-600',
      'FULFILLED': 'text-green-600',
      'CANCELED': 'text-red-600',
      'EXPIRED': 'text-gray-600',
    };
    
    return statusColors[status] || 'text-gray-600';
  };
  
  // Format date to relative time (today, yesterday, or date)
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };
  
  if (!isConnected) {
    return null;
  }
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Payment Requests</CardTitle>
          <CardDescription>Your recent payment requests</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs"
          onClick={() => router.push('/request/create')}
        >
          <CirclePlus className="h-3.5 w-3.5 mr-1" />
          New Request
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            <p>No payment requests found</p>
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => router.push('/request/create')}
            >
              Create your first request
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div 
                key={request.id} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => router.push(`/request/${request.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <QrCode className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium line-clamp-1">
                      Request for <PyusdIcon className="inline h-3.5 w-3.5 mx-0.5" /> {request.amount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeDate(request.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className={`text-xs font-medium ${getStatusColor(request.status)} mr-2`}>
                    {request.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs mt-2"
              onClick={() => router.push('/request/list')}
            >
              View all requests
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <PageWrapper>
      <DashboardContent />
    </PageWrapper>
  );
}

function DashboardContent() {
  const { address, isConnected, status } = useAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentNetwork, setCurrentNetwork] = useState<Network>('sepolia');
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // Debug wallet connection status
  useEffect(() => {
    console.log('Wallet connection status:', {
      status,
      isConnected,
      address,
      hasEthereum: typeof window !== 'undefined' && !!window.ethereum
    });
  }, [status, isConnected, address]);

  // Fetch user profile on load
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/users?walletAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
          } else {
            router.push('/'); // Redirect to homepage if no user profile
          }
        } else {
          router.push('/'); // Redirect to homepage on error
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [address, isConnected, router, toast]);

  // Handle copy username to clipboard
  const copyUsernameToClipboard = () => {
    if (user?.username) {
      navigator.clipboard.writeText(user.username)
        .then(() => {
          toast({
            title: 'Username Copied',
            description: `@${user.username} copied to clipboard`,
          });
        })
        .catch((err) => {
          console.error('Failed to copy username:', err);
        });
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    // Check if we need to connect wallet first
    if ((value === 'send' || value === 'request') && !isConnected) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to perform this action',
      });
      return;
    }
    
    setActiveTab(value);
  };

  // Redirect to login if not connected
  if (!isConnected && !loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b py-4 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
            </div>
            <ConnectWallet size="sm" showAddress={true} />
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto shadow-lg border-blue-100">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <ConnectWallet size="lg" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b py-4 bg-background/95 backdrop-blur-sm">
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
        
        <main className="flex-1 container mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white animate-pulse">
              <RefreshCw className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">Loading your dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar/User Profile */}
          <div className="col-span-1">
            <Card className="sticky top-24 shadow-sm border-blue-100">
              <CardHeader className="pb-0">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold mb-3">
                    {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">{user?.displayName || user?.username}</h2>
                    <div className="flex items-center justify-center gap-1 text-gray-500 mt-1 cursor-pointer" onClick={copyUsernameToClipboard}>
                      <span>@{user?.username}</span>
                      <Copy className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <Separator className="my-4" />
                <div className="space-y-2">
                  <PyusdBalance address={address} network={currentNetwork} />
                  
                  <Separator className="my-4" />
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    onClick={() => handleTabChange('send')}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Payment
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => handleTabChange('request')}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Request Payment
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-blue-200 text-gray-700 hover:bg-blue-50"
                    onClick={() => router.push('/profile')}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-blue-200 text-gray-700 hover:bg-blue-50"
                    onClick={() => router.push('/analytics')}
                  >
                    <BarChart className="mr-2 h-4 w-4" />
                    Analytics Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Panel */}
          <div className="col-span-1 lg:col-span-3">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="send">Send</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                <RequestOverview />
                <TransactionHistory address={address} network={currentNetwork} limit={5} />
                
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Your Payment Link</CardTitle>
                    <CardDescription>Share this link to receive payments from others</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-medium truncate">
                        {window.location.origin}/pay/{user?.username}
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/pay/${user?.username}`)
                            .then(() => {
                              toast({
                                title: 'Link Copied',
                                description: 'Payment link copied to clipboard',
                              });
                            });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="send">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Send PYUSD</CardTitle>
                    <CardDescription>Send payments to any username</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isConnected ? (
                      <SendPaymentForm 
                        senderAddress={address} 
                        network={currentNetwork}
                        onSuccess={() => {
                          setActiveTab('overview');
                          toast({
                            title: 'Payment Sent',
                            description: 'Your payment has been processed successfully',
                          });
                        }}
                      />
                    ) : (
                      <div className="text-center py-6">
                        <p className="mb-4 text-gray-500">Please connect your wallet to send payments</p>
                        <ConnectWallet size="default" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="request">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Request Payment</CardTitle>
                    <CardDescription>Create a payment request to share with others</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isConnected ? (
                      <RequestPaymentForm
                        userAddress={address}
                        onSuccess={() => {
                          setActiveTab('overview');
                          toast({
                            title: 'Request Created',
                            description: 'Your payment request has been created successfully',
                          });
                        }}
                      />
                    ) : (
                      <div className="text-center py-6">
                        <p className="mb-4 text-gray-500">Please connect your wallet to create payment requests</p>
                        <ConnectWallet size="default" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <span className="logo-text text-gray-800 text-lg">phaigo</span>
            </div>
            
            <div className="flex items-center space-x-4 text-muted-foreground text-sm">
              <Link href="/analytics" className="hover:text-blue-600 hover:underline">Analytics</Link>
              <Link href="/about" className="hover:text-blue-600 hover:underline">About</Link>
              <span>&copy; {new Date().getFullYear()} Phaigo</span>
              <span>- Powered by <a href="https://www.pyusd.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PYUSD</a></span>
            </div>
          </div>
        </div>
      </footer>
      
      <Toaster />
    </div>
  );
}
