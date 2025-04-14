import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to get event logs using eth_getLogs RPC method
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    const address = searchParams.get('address');
    const fromBlock = searchParams.get('fromBlock') || 'latest';
    const toBlock = searchParams.get('toBlock') || 'latest';
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Validate parameters
    if (!network || !isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network specified' },
        { status: 400 }
      );
    }
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }
    
    // Get the secure RPC URL with API key
    const rpcUrl = getServerRpcUrl(network as 'mainnet' | 'sepolia');
    
    // Format block parameters
    const fromBlockParam = fromBlock === 'latest' ? 'latest' : 
      fromBlock.startsWith('0x') ? fromBlock : `0x${parseInt(fromBlock).toString(16)}`;
    
    const toBlockParam = toBlock === 'latest' ? 'latest' : 
      toBlock.startsWith('0x') ? toBlock : `0x${parseInt(toBlock).toString(16)}`;
    
    // Define parameters for eth_getLogs
    const params = {
      address,
      fromBlock: fromBlockParam,
      toBlock: toBlockParam
    };
    
    // Call the eth_getLogs RPC method
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [params]
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const logsResult = await response.json();
    
    // Check for RPC errors
    if (logsResult.error) {
      console.error('RPC error when getting logs:', logsResult.error);
      return NextResponse.json(
        { error: logsResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    // Limit the number of logs to return
    const limitedLogs = logsResult.result.slice(0, limit);
    
    // Define a type for the raw log object from RPC
    type RawLogEntry = {
      address: string;
      blockHash: string;
      blockNumber: string;
      data: string;
      logIndex: string;
      removed: boolean;
      topics: string[];
      transactionHash: string;
      transactionIndex: string;
    };
    
    // For each log, get the block timestamp
    const logsWithTimestamp = await Promise.all(limitedLogs.map(async (log: RawLogEntry) => {
      try {
        // Get block info to get timestamp
        const blockResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByHash',
            params: [log.blockHash, false]
          }),
        });
        
        const blockResult = await blockResponse.json();
        const timestamp = blockResult.result ? parseInt(blockResult.result.timestamp, 16) : 0;
        
        return {
          ...log,
          timestamp
        };
      } catch (error) {
        console.error('Error getting block timestamp:', error);
        return {
          ...log,
          timestamp: 0
        };
      }
    }));
    
    // Return the logs wrapped in an object with a 'logs' key
    return NextResponse.json({ logs: logsWithTimestamp });
  } catch (error) {
    console.error('Error getting logs:', error);
    return NextResponse.json(
      { error: 'Failed to get logs', message: (error as Error).message },
      { status: 500 }
    );
  }
}