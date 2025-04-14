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
import { Tabs   , TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ExternalLink, Search, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ethers } from 'ethers';

// Define types for our API responses
interface BlockData {
  number: string;
  hash: string;
  timestamp: string;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
}

interface TransactionData {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  gasUsed: string;
  gasPrice: string;
  methodId?: string;
  methodName?: string;
  topics?: string[];
  data?: string;
}

interface LogEntry {
  address: string;
  blockHash: string;
  blockNumber: string;
  data: string;
  logIndex: string;
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: string;
}

interface LogsResponse {
  logs: LogEntry[];
}

interface BlockTraceAction {
  callType?: string;
  from?: string;
  to?: string;
  input?: string;
  gas?: string;
  value?: string;
}

interface BlockTraceResult {
  gasUsed?: string;
  output?: string;
}

interface BlockTraceEntry {
  action?: BlockTraceAction;
  blockHash?: string;
  blockNumber?: number;
  result?: BlockTraceResult;
  subtraces?: number;
  traceAddress?: number[];
  transactionHash?: string;
  transactionPosition?: number;
  type?: string;
  error?: string;
}

interface BlockTraceData {
  blockNumber: string;
  pyusdTransactionCount: number;
  totalTransactionCount: number;
  pyusdTransactions: BlockTraceEntry[];
}

interface TransactionTraceData {
  transactionHash: string;
  blockNumber: number;
  status: string;
  gasInfo?: {
    gasUsed: string;
  };
  error?: string;
  stateChanges: unknown;
}

interface StorageRangeData {
  address: string;
  storageMap: Record<string, { key: string; value: string }>;
}

// Helper function to safely get error message from API response
const getApiErrorMessage = (data: unknown, defaultMessage: string): string => {
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return defaultMessage;
};

export function DeepDive({ network }: { network: Network }) {
  // Tab and method selection state
  const [activeTab, setActiveTab] = useState('block-explorer');
  const [selectedMethod, setSelectedMethod] = useState('eth_getBlockByNumber');
  
  // Input parameters state
  const [blockNumber, setBlockNumber] = useState('latest');
  const [blockHash, setBlockHash] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [address, setAddress] = useState('');
  const [isTracingPyusd, setIsTracingPyusd] = useState(true);
  const maxResults = 20; // Use a const if slider is removed
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result data states
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [transactionsData, setTransactionsData] = useState<TransactionData[]>([]);
  const [blockTraceData, setBlockTraceData] = useState<BlockTraceData | null>(null);
  const [transactionTraceData, setTransactionTraceData] = useState<TransactionTraceData | null>(null);
  const [storageRangeData, setStorageRangeData] = useState<StorageRangeData | null>(null);
  
  // Method to estimate quota cost
  const getQuotaCost = (method: string): number => {
    const costMap: Record<string, number> = {
      'eth_getBlockByNumber': 1,
      'eth_getBlockByHash': 1,
      'eth_getTransactionByHash': 1,
      'eth_getCode': 10,
      'eth_getLogs': 50,
      'trace_block': 50,
      'debug_traceTransaction': 50,
      'debug_storageRangeAt': 50
    };
    return costMap[method] || 1;
  };

  // Get a human-readable method name
  const getMethodDisplayName = (method: string): string => {
    const displayNames: Record<string, string> = {
      'eth_getBlockByNumber': 'Get Block by Number',
      'eth_getBlockByHash': 'Get Block by Hash',
      'eth_getTransactionByHash': 'Get Transaction',
      'eth_getCode': 'Get Contract Code',
      'eth_getLogs': 'Get Event Logs',
      'trace_block': 'Trace Block',
      'debug_traceTransaction': 'Trace Transaction',
      'debug_storageRangeAt': 'View Contract Storage'
    };
    return displayNames[method] || method;
  };

  // Format address for display
  const formatAddress = (addr: string | undefined | null): string => {
    if (!addr || typeof addr !== 'string' || !ethers.isAddress(addr)) return 'Invalid Address';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Format timestamp to date
  const formatDate = (timestamp: string | number | undefined | null): string => {
    if (timestamp === undefined || timestamp === null) return '-';
    let numTimestamp: number;
    if (typeof timestamp === 'string') {
      try {
        numTimestamp = parseInt(timestamp, 16); // Assume hex for block timestamps
      } catch { // Removed unused variable 'parseError'
        const num = Number(timestamp);
        if (!isNaN(num)) {
          numTimestamp = num;
        } else {
          console.warn(`Could not parse timestamp: ${timestamp}`);
          return 'Invalid Date';
        }
      }
    } else {
        numTimestamp = timestamp;
    }
    if (isNaN(numTimestamp) || numTimestamp <= 0) {
      return '-'; 
    }
    // Check for absurdly large values which might indicate ms instead of s
    if (numTimestamp > Date.now() / 100) { // Check if it's likely ms (allow some buffer)
      return new Date(numTimestamp).toLocaleString();
    } else {
      return new Date(numTimestamp * 1000).toLocaleString();
    }
  };

  // Format value in ETH
  const formatEth = (value: string | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    try {
      const wei = typeof value === 'string' && value.startsWith('0x') 
        ? BigInt(value) 
        : BigInt(value);
      const ethValue = Number(wei) / 1e18; 
      if (ethValue > 0 && ethValue < 0.000001) {
        return '< 0.000001';
      }
      return ethValue.toFixed(6);
    } catch (err) {
      console.error("Error formatting ETH value:", err, "Value:", value);
      return typeof value === 'string' ? value : 'Invalid Value'; 
    }
  };

  // Handle method execution
  const executeMethod = async () => {
    setIsLoading(true);
    setError(null);
    setBlockData(null);
    setTransactionsData([]);
    setBlockTraceData(null);
    setTransactionTraceData(null);
    setStorageRangeData(null);
    
    try {
      let response;
      let data: unknown; 
      
      switch (selectedMethod) {
        case 'eth_getBlockByNumber':
          response = await fetch(`/api/blockchain/block?network=${network}&blockNumber=${blockNumber}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'number' in data) {
            setBlockData(data as BlockData);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch block data'));
          }
          break;
          
        case 'eth_getBlockByHash':
          if (!blockHash || !blockHash.startsWith('0x') || blockHash.length !== 66) {
             throw new Error('Valid block hash (0x...) is required');
          }
          response = await fetch(`/api/blockchain/block?network=${network}&blockHash=${blockHash}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'number' in data) {
            setBlockData(data as BlockData);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch block data'));
          }
          break;
          
        case 'eth_getTransactionByHash':
          if (!transactionHash || !transactionHash.startsWith('0x') || transactionHash.length !== 66) {
            throw new Error('Valid transaction hash (0x...) is required');
          }
          response = await fetch(`/api/blockchain/transaction?network=${network}&txHash=${transactionHash}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'hash' in data) {
            setTransactionsData([data as TransactionData]);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch transaction data'));
          }
          break;
          
        case 'trace_block':
          response = await fetch(`/api/blockchain/block/trace?network=${network}&blockNumber=${blockNumber}&filterPyusd=${isTracingPyusd}`); 
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'pyusdTransactions' in data) {
            setBlockTraceData(data as BlockTraceData);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to trace block'));
          }
          break;
          
        case 'debug_traceTransaction':
          if (!transactionHash || !transactionHash.startsWith('0x') || transactionHash.length !== 66) {
            throw new Error('Valid transaction hash (0x...) is required');
          }
          response = await fetch(`/api/blockchain/transaction/trace?network=${network}&txHash=${transactionHash}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && ('gasInfo' in data || 'stateChanges' in data || 'status' in data) ) {
            setTransactionTraceData(data as TransactionTraceData);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to trace transaction'));
          }
          break;
          
        case 'debug_storageRangeAt':
          if (!address || !ethers.isAddress(address)) {
            throw new Error('Valid contract address is required');
          }
          response = await fetch(`/api/blockchain/storage?network=${network}&address=${address}&blockNumber=${blockNumber}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'storageMap' in data) {
            setStorageRangeData(data as StorageRangeData);
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch storage data'));
          }
          break;
          
        case 'eth_getCode':
          if (!address || !ethers.isAddress(address)) {
             throw new Error('Valid contract address is required');
          }
          response = await fetch(`/api/blockchain/code?network=${network}&address=${address}`);
          data = await response.json();
          if (response.ok && data && typeof data === 'object' && 'code' in data) {
            const codeData = data as { code: string };
            setStorageRangeData({
              address,
              storageMap: {
                'bytecode': { 
                  key: 'bytecode', 
                  value: codeData.code?.substring(0, 1000) + (codeData.code?.length > 1000 ? '...' : '') || 'No code found at this address' 
                }
              }
            });
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch contract code'));
          }
          break;
          
        case 'eth_getLogs':
          if (!address || !ethers.isAddress(address)) {
             throw new Error('Valid contract address is required');
          }
          response = await fetch(`/api/blockchain/logs?network=${network}&address=${address}&limit=${maxResults}`);
          data = await response.json();
          const logsResponse = data as LogsResponse; 
          if (response.ok && Array.isArray(logsResponse?.logs)) {
            setTransactionsData(logsResponse.logs.map((log: LogEntry) => ({ 
              hash: log.transactionHash ?? 'N/A',
              from: log.address ?? 'N/A',
              to: '', 
              timestamp: 0, 
              value: '0', 
              gasUsed: '', 
              gasPrice: '', 
              methodId: log.topics?.[0] || '', 
              methodName: 'Event',
              topics: log.topics ?? [], 
              data: log.data ?? '0x' 
            })));
          } else {
            throw new Error(getApiErrorMessage(data, 'Failed to fetch event logs or invalid response format'));
          }
          break;
          
        default:
          throw new Error(`Method ${selectedMethod} not implemented`);
      }
    } catch (err) {
      console.error('Error executing method:', err);
      setError((err as Error).message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Fill PYUSD address on selection
  useEffect(() => {
    if (isTracingPyusd) {
      setAddress(network === 'mainnet' 
        ? '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8' 
        : '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9');
    }
  }, [isTracingPyusd, network]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium">PYUSD Deep Dive</CardTitle>
              <CardDescription>
                Explore PYUSD blockchain data using GCP&apos;s advanced RPC methods
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="block-explorer">Block Explorer</TabsTrigger>
              <TabsTrigger value="transaction-tracer">Transaction Tracer</TabsTrigger>
              <TabsTrigger value="contract-analyzer">Contract Analyzer</TabsTrigger>
            </TabsList>
            
            {/* Method Selection and Parameters */}
            <div className="mb-6 space-y-4 border rounded-md p-4 bg-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="method">RPC Method</Label>
                  <Select 
                    value={selectedMethod} 
                    onValueChange={(value) => setSelectedMethod(value)}
                  >
                    <SelectTrigger id="method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTab === 'block-explorer' && (
                        <>
                          <SelectItem value="eth_getBlockByNumber">Get Block by Number</SelectItem>
                          <SelectItem value="eth_getBlockByHash">Get Block by Hash</SelectItem>
                          <SelectItem value="trace_block">Trace Block (Advanced)</SelectItem>
                        </>
                      )}
                      {activeTab === 'transaction-tracer' && (
                        <>
                          <SelectItem value="eth_getTransactionByHash">Get Transaction Details</SelectItem>
                          <SelectItem value="debug_traceTransaction">Trace Transaction Execution</SelectItem>
                        </>
                      )}
                      {activeTab === 'contract-analyzer' && (
                        <>
                          <SelectItem value="eth_getCode">View Contract Bytecode</SelectItem>
                          <SelectItem value="debug_storageRangeAt">View Contract Storage</SelectItem>
                          <SelectItem value="eth_getLogs">Get Contract Events</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <div className="mt-2 flex items-center">
                    <Badge className="mr-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
                      Quota Cost: {getQuotaCost(selectedMethod)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedMethod.includes('trace') || selectedMethod.includes('debug') ? 
                        'Advanced method - free with GCP' : 'Standard method'}
                    </span>
                  </div>
                </div>
                
                <div>
                  {(selectedMethod === 'eth_getBlockByNumber' || selectedMethod === 'trace_block' || selectedMethod === 'debug_storageRangeAt') && (
                    <div className="space-y-2">
                      <Label htmlFor="blockNumber">Block Number (or &quot;latest&quot;)</Label>
                      <Input
                        id="blockNumber"
                        value={blockNumber}
                        onChange={(e) => setBlockNumber(e.target.value)}
                        placeholder="latest"
                      />
                    </div>
                  )}
                  
                  {selectedMethod === 'eth_getBlockByHash' && (
                    <div className="space-y-2">
                      <Label htmlFor="blockHash">Block Hash</Label>
                      <Input
                        id="blockHash"
                        value={blockHash}
                        onChange={(e) => setBlockHash(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                  )}
                  
                  {(selectedMethod === 'eth_getTransactionByHash' || selectedMethod === 'debug_traceTransaction') && (
                    <div className="space-y-2">
                      <Label htmlFor="transactionHash">Transaction Hash</Label>
                      <Input
                        id="transactionHash"
                        value={transactionHash}
                        onChange={(e) => setTransactionHash(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                  )}
                  
                  {(selectedMethod === 'eth_getCode' || selectedMethod === 'debug_storageRangeAt' || selectedMethod === 'eth_getLogs') && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="address">Contract Address</Label>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="pyusdSwitch" 
                            checked={isTracingPyusd} 
                            onCheckedChange={setIsTracingPyusd} 
                          />
                          <Label htmlFor="pyusdSwitch" className="text-xs">Use PYUSD Contract</Label>
                        </div>
                      </div>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="0x..."
                        disabled={isTracingPyusd}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={executeMethod} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Execute {getMethodDisplayName(selectedMethod)}
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Results Display Area */}
            <div className="border rounded-md p-4 bg-white/5 min-h-[200px]">
              <h3 className="text-lg font-medium mb-4">Results</h3>
              
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div>
                  {/* Block Data */}
                  {blockData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Block Number</h4>
                          <p>{parseInt(blockData.number, 16).toString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Block Hash</h4>
                          <p className="font-mono text-xs truncate">{blockData.hash}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Timestamp</h4>
                          <p>{formatDate(blockData.timestamp)}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Transactions</h4>
                          <p>{blockData.transactions.length}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Gas Used</h4>
                          <p>{parseInt(blockData.gasUsed, 16).toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Gas Limit</h4>
                          <p>{parseInt(blockData.gasLimit, 16).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-medium mt-4 mb-2">Transactions</h4>
                      <ScrollArea className="rounded-md border overflow-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Index</TableHead>
                              <TableHead>Hash</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {blockData.transactions.slice(0, 50).map((tx, index) => (
                              <TableRow key={index}>
                                <TableCell>{index}</TableCell>
                                <TableCell className="font-mono text-xs">{formatAddress(tx)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        setTransactionHash(tx);
                                        setSelectedMethod('debug_traceTransaction');
                                        setActiveTab('transaction-tracer');
                                        await new Promise(resolve => setTimeout(resolve, 0)); 
                                        await executeMethod(); 
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
                                        href={getExplorerUrl(network, tx)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        aria-label={`View transaction on block explorer`}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {blockData.transactions.length > 50 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                  Showing 50 of {blockData.transactions.length} transactions
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea> 
                    </div>
                  )}
                  
                  {/* Transaction Data */}
                  {transactionsData.length > 0 && (
                    <div className="space-y-4">
                      {transactionsData[0].methodId && ( 
                        <Alert className="mb-4">
                          <Info className="h-4 w-4" />
                          <AlertTitle>Event Log</AlertTitle>
                          <AlertDescription>
                            Showing event logs {transactionsData[0].methodId ? `with signature hash: ${transactionsData[0].methodId.substring(0,10)}...` : ''}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <ScrollArea className="rounded-md border overflow-auto max-h-[60vh]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {transactionsData[0].timestamp > 0 && <TableHead>Time</TableHead>}
                              <TableHead>Hash</TableHead>
                              <TableHead>From</TableHead>
                              <TableHead>To</TableHead>
                              {!transactionsData[0].methodId && <TableHead className="text-right">Value</TableHead>}
                              {transactionsData[0].methodId && <TableHead>Topics</TableHead>}
                              {transactionsData[0].methodId && <TableHead>Data</TableHead>}
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactionsData.map((tx, index) => (
                              <TableRow key={index}>
                                {tx.timestamp > 0 && <TableCell>{formatDate(tx.timestamp)}</TableCell>}
                                <TableCell className="font-mono text-xs">{formatAddress(tx.hash)}</TableCell>
                                <TableCell className="font-mono text-xs">{formatAddress(tx.from)}</TableCell>
                                <TableCell className="font-mono text-xs">{formatAddress(tx.to)}</TableCell>
                                
                                {!tx.methodId && <TableCell className="text-right">{formatEth(tx.value)} ETH</TableCell>}
                                
                                {tx.methodId && tx.topics && (
                                  <TableCell className="font-mono text-xs max-w-xs">
                                    <ScrollArea className="h-16"> 
                                      {tx.topics?.slice(1).map((topic: string, i: number) => (
                                        <div key={i} className="truncate" title={topic}>{topic}</div>
                                      ))}
                                      {(!tx.topics || tx.topics.length <= 1) && <span className="text-muted-foreground italic">No indexed topics</span>}
                                    </ScrollArea>
                                  </TableCell>
                                )}
                                
                                {tx.methodId && tx.data && (
                                  <TableCell className="font-mono text-xs max-w-xs">
                                     <ScrollArea className="h-16">
                                      <p className="break-all whitespace-pre-wrap">{tx.data && tx.data !== '0x' ? tx.data : '0x'}</p>
                                     </ScrollArea>
                                  </TableCell>
                                )}
                                
                                <TableCell>
                                  <div className="flex gap-2 justify-end">
                                    {!tx.methodId && ( 
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => { 
                                          setTransactionHash(tx.hash);
                                          setSelectedMethod('debug_traceTransaction');
                                          setActiveTab('transaction-tracer'); 
                                          await new Promise(resolve => setTimeout(resolve, 0));
                                          await executeMethod();
                                        }}
                                      >
                                        Trace
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      asChild
                                    >
                                      <a 
                                        href={getExplorerUrl(network, tx.hash)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        aria-label={`View on block explorer`}
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
                      </ScrollArea>
                    </div>
                  )}
                  
                  {/* Block Trace Data */}
                  {blockTraceData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Block Number</h4>
                          <p>{blockTraceData.blockNumber === 'latest' ? 'Latest' : blockTraceData.blockNumber}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Total Transactions</h4>
                          <p>{blockTraceData.totalTransactionCount}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">PYUSD Transactions</h4>
                          <p>{blockTraceData.pyusdTransactionCount}</p>
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-medium mt-4 mb-2">PYUSD Transactions in Block</h4>
                      {blockTraceData.pyusdTransactionCount > 0 ? (
                        <ScrollArea className="rounded-md border overflow-auto max-h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Transaction Hash</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Value (PYUSD)</TableHead> 
                                <TableHead>Gas Used</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {blockTraceData.pyusdTransactions.map((trace: BlockTraceEntry, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-mono text-xs">{formatAddress(trace.transactionHash)}</TableCell>
                                  <TableCell><Badge variant={trace.action?.callType === 'call' ? 'default' : 'secondary'}>{trace.action?.callType || 'N/A'}</Badge></TableCell>
                                  <TableCell className="font-mono text-xs">{formatAddress(trace.action?.to)}</TableCell>
                                  <TableCell>{formatEth(trace.action?.value)}</TableCell>
                                  <TableCell>{trace.result?.gasUsed ? parseInt(trace.result.gasUsed, 16).toLocaleString() : 'N/A'}</TableCell>
                                  <TableCell>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        asChild
                                      >
                                        <a 
                                          href={trace.transactionHash ? getExplorerUrl(network, trace.transactionHash) : '#'} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          aria-label={`View on block explorer`}
                                          className={!trace.transactionHash ? 'pointer-events-none opacity-50' : ''} 
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea> 
                      ) : (
                        <p className="text-muted-foreground italic">No PYUSD transactions found in this block trace.</p>
                      )}
                    </div>
                  )}

                  {/* Transaction Trace Data */}
                  {transactionTraceData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Transaction Hash</h4>
                          <p className="font-mono text-xs truncate">{transactionTraceData.transactionHash}</p>
                        </div>
                         <div className="bg-white/5 p-3 rounded-md">
                           <h4 className="text-sm font-medium text-muted-foreground">Block Number</h4>
                           <p>{transactionTraceData.blockNumber}</p>
                         </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                          <Badge variant={transactionTraceData.status === '0x1' ? 'default' : 'destructive'}>
                            {transactionTraceData.status === '0x1' ? 'Success' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="bg-white/5 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-muted-foreground">Gas Used</h4>
                          <p>{transactionTraceData.gasInfo?.gasUsed ? parseInt(transactionTraceData.gasInfo.gasUsed, 16).toLocaleString() : 'N/A'}</p>
                        </div>
                        {transactionTraceData.error && (
                          <div className="bg-destructive/10 text-destructive p-3 rounded-md col-span-1 md:col-span-2">
                            <h4 className="text-sm font-medium">Error</h4>
                            <p className="text-xs">{transactionTraceData.error}</p>
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-medium mt-4 mb-2">State Changes / Calls</h4>
                       <ScrollArea className="rounded-md border overflow-auto max-h-96 font-mono text-xs p-4 bg-black/5">
                        <pre>{JSON.stringify(transactionTraceData.stateChanges || transactionTraceData, null, 2)}</pre>
                      </ScrollArea>
                    </div>
                  )}
                  
                  {/* Storage Range Data */}
                  {storageRangeData && (
                    <div className="space-y-4">
                      <div className="bg-white/5 p-3 rounded-md mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Contract Address</h4>
                        <p className="font-mono text-xs">{storageRangeData.address}</p>
                      </div>
                      
                      <h4 className="text-sm font-medium mt-4 mb-2">
                         {storageRangeData.storageMap['bytecode'] ? 'Contract Bytecode' : 'Storage Slots'}
                      </h4>
                      <ScrollArea className="rounded-md border overflow-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{storageRangeData.storageMap['bytecode'] ? 'Preview' : 'Slot Key'}</TableHead>
                              <TableHead>{storageRangeData.storageMap['bytecode'] ? '' : 'Value'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {Object.entries(storageRangeData.storageMap).map(([key, slot]) => (
                               <TableRow key={key}>
                                 <TableCell className="font-mono text-xs">{slot.key}</TableCell>
                                 <TableCell className="font-mono text-xs break-all">{slot.value}</TableCell>
                               </TableRow>
                             ))}
                             {Object.keys(storageRangeData.storageMap).length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center text-muted-foreground italic">No storage data found or contract has no code.</TableCell>
                                </TableRow>
                             )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}

                  {/* No results placeholder */}
                   {!blockData && !transactionsData.length && !blockTraceData && !transactionTraceData && !storageRangeData && !isLoading && (
                     <p className="text-muted-foreground italic text-center py-8">No results to display. Execute a method above.</p>
                   )}
                </div> 
              )} 
            </div> 
          </Tabs> 
        </CardContent> 
      </Card> 
    </div> 
  );
}