'use client';

import { useState, useEffect } from 'react';
import { Network } from '@/types/network';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import PyusdIcon from '@/components/ui/pyusd-icon';

// Analytics service is imported directly from the service file
import { singleton } from '@/lib/utils/singleton';
import { PyusdAnalyticsService } from '@/lib/services/blockchain/analytics';

const analyticsService = singleton(PyusdAnalyticsService); 

interface MarketData {
  totalSupply: string;
  marketCap: string;
  price: string;
  holders: number;
  transactions24h: number;
}

interface TopHolder {
  address: string;
  balance: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
}

export function PyusdOverview({ network }: { network: Network }) {
  const [isLoading, setIsLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch market data
        const marketDataResult = await analyticsService.getTokenMarketData(network);
        setMarketData(marketDataResult);

        // Fetch top holders
        const holdersResult = await analyticsService.getTopHolders(network, 5);
        setTopHolders(holdersResult);

        // Fetch recent transactions
        const txsResult = await analyticsService.getRecentTransactions(network, 5);
        
        // Handle both possible return types from getRecentTransactions
        if (Array.isArray(txsResult)) {
          // Legacy format - direct array of TransactionData
          setRecentTxs(txsResult);
        } else {
          // New format - object with pagination data and transactions array
          // Convert RecentTransaction to Transaction by adding the missing 'value' field
          const convertedTransactions = txsResult.transactions.map(tx => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            timestamp: tx.timestamp,
            value: '0' // Add a default value since it's missing in RecentTransaction
          }));
          setRecentTxs(convertedTransactions);
        }
      } catch (error) {
        console.error('Error fetching PYUSD overview data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [network]);

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format timestamp to date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* PYUSD Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <PyusdIcon className="h-6 w-6" />
            PYUSD Token Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold">${marketData?.price}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Market Cap</p>
                  <p className="text-2xl font-bold">${Number(marketData?.marketCap).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Supply</p>
                  <p className="text-2xl font-bold">{Number(marketData?.totalSupply).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">24h Transactions</p>
                  <p className="text-2xl font-bold">{marketData?.transactions24h.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holders</p>
                <p className="text-2xl font-bold">{marketData?.holders.toLocaleString()}</p>
              </div>
              <div className="pt-2">
                <Badge variant="outline" className="bg-blue-50">Network: {network === 'mainnet' ? 'Ethereum Mainnet' : 'Sepolia Testnet'}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Holders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Top PYUSD Holders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topHolders.map((holder, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{formatAddress(holder.address)}</TableCell>
                    <TableCell className="text-right">{Number(holder.balance).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Recent PYUSD Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTxs.map((tx, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDate(tx.timestamp)}</TableCell>
                    <TableCell className="font-mono">{formatAddress(tx.hash)}</TableCell>
                    <TableCell className="font-mono">{formatAddress(tx.from)}</TableCell>
                    <TableCell className="font-mono">{formatAddress(tx.to)}</TableCell>
                    <TableCell className="text-right">{Number(tx.value).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
