'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  PlusCircle
} from 'lucide-react';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { format } from 'date-fns';

interface RequestItem {
  id: string;
  amount: string;
  notes: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string | null;
  user: {
    username: string;
    displayName: string | null;
  };
}

export default function RequestListPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  
  useEffect(() => {
    const fetchRequests = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/requests?walletAddress=${address}`);
        const data = await response.json();
        
        if (response.ok) {
          setRequests(data.requests || []);
        } else {
          toast({
            title: 'Error',
            description: data.error || 'Failed to load requests',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching requests:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
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
  }, [address, isConnected, toast]);

  // Filter requests based on active tab
  const filteredRequests = requests.filter(request => {
    if (activeTab === 'all') return true;
    if (activeTab === 'open') return request.status === 'OPEN';
    if (activeTab === 'completed') return request.status === 'FULFILLED';
    if (activeTab === 'other') {
      return ['IN_PROGRESS', 'CANCELED', 'EXPIRED'].includes(request.status);
    }
    return true;
  });

  // Get status details
  const getStatusDetails = (status: string) => {
    const statusMap: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
      'OPEN': { 
        text: 'Open', 
        color: 'text-blue-600', 
        icon: <Clock className="h-4 w-4 text-blue-600" /> 
      },
      'IN_PROGRESS': { 
        text: 'In Progress', 
        color: 'text-amber-600',
        icon: <RefreshCw className="h-4 w-4 text-amber-600" />
      },
      'FULFILLED': { 
        text: 'Fulfilled', 
        color: 'text-green-600',
        icon: <CheckCircle className="h-4 w-4 text-green-600" />
      },
      'CANCELED': { 
        text: 'Canceled', 
        color: 'text-red-600',
        icon: <XCircle className="h-4 w-4 text-red-600" />
      },
      'EXPIRED': { 
        text: 'Expired', 
        color: 'text-gray-600',
        icon: <XCircle className="h-4 w-4 text-gray-600" />
      },
    };
    
    return statusMap[status] || { text: status, color: 'text-gray-600', icon: null };
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto pt-8 px-4 pb-16">
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <Button 
          onClick={() => router.push('/request/create')}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Payment Requests</CardTitle>
          <CardDescription>Manage your payment requests</CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </div>
          
          <Separator className="my-4" />
          
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No payment requests found</p>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/request/create')}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create a Request
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => {
                  const statusDetails = getStatusDetails(request.status);
                  
                  return (
                    <div 
                      key={request.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/request/${request.id}`)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <QrCode className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center">
                              <PyusdIcon className="mr-1" size={16} />
                              <span className="font-semibold">{request.amount}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Created {formatDate(request.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          {statusDetails.icon}
                          <span className={`ml-1 text-sm font-medium ${statusDetails.color}`}>
                            {statusDetails.text}
                          </span>
                        </div>
                      </div>
                      
                      {request.notes && (
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                          {request.notes}
                        </p>
                      )}
                      
                      {request.expiresAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Expires: {formatDate(request.expiresAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
} 