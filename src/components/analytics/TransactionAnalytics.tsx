'use client';

import { useState, useEffect } from 'react';
import { Network, getExplorerUrl } from '@/types/network';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, Search } from 'lucide-react';

import { singleton } from '@/lib/utils/singleton'; 
import { PyusdAnalyticsService } from '@/lib/services/blockchain/analytics';

const analyticsService = singleton(PyusdAnalyticsService);

interface TransactionData {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  gasCost: string;
}

interface StateChange {
  address?: string;
  key?: string;
  value?: string;
  [key: string]: unknown;
}

interface TransactionTrace {
  transactionHash: string;
  blockNumber: number;
  status: string;
  gasInfo?: {
    gasUsed: string;
  };
  error?: string;
  stateChanges: StateChange[];
  [key: string]: unknown;
}

export function TransactionAnalytics({ network }: { network: Network }) {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [searchTxHash, setSearchTxHash] = useState('');
  const [traceData, setTraceData] = useState<TransactionTrace | null>(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await analyticsService.getRecentTransactions(network, 20);
        
        // Handle both possible return types from getRecentTransactions
        if (Array.isArray(result)) {
          // Legacy format - direct array of TransactionData
          setTransactions(result);
        } else {
          // New format - object with pagination data
          // We need to convert RecentTransaction[] to TransactionData[]
          // by adding any missing fields that TransactionData requires
          const formattedTransactions = result.transactions.map(tx => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            timestamp: tx.timestamp,
            // If these fields don't exist in RecentTransaction, provide defaults
            value: 'value' in tx ? String(tx.value) : '0',
            gasUsed: tx.gasUsed || '0',
            gasPrice: '0',
            gasCost: '0',
            method: tx.method || 'unknown'
          }));
          setTransactions(formattedTransactions);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setError('Failed to load transaction data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [network]);

  const handleSearchTrace = async () => {
    if (!searchTxHash || searchTxHash.trim().length < 10) return;
    
    setIsTraceLoading(true);
    setTraceData(null);
    setError(null);
    
    try {
      const result = await analyticsService.getTransactionTrace(searchTxHash, network);
      if (result) {
        setTraceData(result);
        setActiveTab('trace');
      } else {
        setError('Could not retrieve trace data for this transaction.');
      }
    } catch (error) {
      console.error('Error fetching transaction trace:', error);
      setError('Failed to retrieve trace data. Please check the transaction hash and try again.');
    } finally {
      setIsTraceLoading(false);
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format timestamp to date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium">Transaction Analytics</CardTitle>
              <CardDescription>
                Analyze PYUSD transaction data using GCP&apos;s blockchain RPC service
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="space-y-2">
                <Label htmlFor="txHash">Transaction Hash</Label>
                <div className="flex gap-2">
                  <Input
                    id="txHash"
                    value={searchTxHash}
                    onChange={(e) => setSearchTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full"
                  />
                  <Button 
                    onClick={handleSearchTrace} 
                    disabled={isTraceLoading || !searchTxHash}
                    size="icon"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="list">Transaction List</TabsTrigger>
              <TabsTrigger value="trace">Transaction Trace</TabsTrigger>
            </TabsList>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <TabsContent value="list">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Hash</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Gas Cost (ETH)</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(tx.timestamp)}</TableCell>
                          <TableCell className="font-mono">{formatAddress(tx.hash)}</TableCell>
                          <TableCell className="font-mono">{formatAddress(tx.from)}</TableCell>
                          <TableCell className="font-mono">{formatAddress(tx.to)}</TableCell>
                          <TableCell className="text-right">{Number(tx.value).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(tx.gasCost).toFixed(6)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSearchTxHash(tx.hash);
                                  handleSearchTrace();
                                }}
                              >
                                Trace
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                asChild
                              >
                                <a 
                                  href={getExplorerUrl(network, tx.hash)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  aria-label={`View transaction ${formatAddress(tx.hash)} on block explorer`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="trace">
              <div className="rounded-md border p-4">
                {isTraceLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : traceData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium">Transaction Hash</h3>
                        <p className="font-mono text-sm break-all">{traceData.transactionHash}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Block Number</h3>
                        <p>{traceData.blockNumber}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Status</h3>
                        <Badge 
                          className={
                            traceData.status === 'SUCCESS' 
                              ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                              : 'bg-red-100 text-red-800 hover:bg-red-100'
                          }
                        >
                          {traceData.status}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Gas Used</h3>
                        <p>{traceData.gasInfo?.gasUsed || 'N/A'}</p>
                      </div>
                    </div>

                    {traceData.error && (
                      <div>
                        <h3 className="text-sm font-medium">Error</h3>
                        <p className="text-red-500">{traceData.error}</p>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-medium mb-2">State Changes</h3>
                      {traceData.stateChanges && traceData.stateChanges.length > 0 ? (
                        <div className="rounded-md border overflow-auto max-h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Key</TableHead>
                                <TableHead>Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {traceData.stateChanges.map((change, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-mono">{formatAddress(change.address || '')}</TableCell>
                                  <TableCell className="font-mono">{formatAddress(change.key || '')}</TableCell>
                                  <TableCell className="font-mono">{change.value ? formatAddress(change.value) : 'NULL'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No state changes found</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        asChild
                        className="flex items-center gap-1"
                      >
                        <a 
                          href={getExplorerUrl(network, traceData.transactionHash)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          View on Etherscan
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Enter a transaction hash to view trace data</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      GCP Blockchain RPC provides free access to computationally expensive methods like debug_traceTransaction
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
