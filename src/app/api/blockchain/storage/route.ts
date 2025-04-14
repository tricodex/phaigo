import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to get contract storage using debug_storageRangeAt RPC method
 * This demonstrates the use of GCP's computationally expensive methods
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    const address = searchParams.get('address');
    const blockNumber = searchParams.get('blockNumber') || 'latest';
    
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
    
    // For debug_storageRangeAt, we need a transaction in the block to specify position
    // First, get the block
    const blockParam = blockNumber === 'latest' ? 'latest' : 
      blockNumber.startsWith('0x') ? blockNumber : `0x${parseInt(blockNumber).toString(16)}`;
    
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: [blockParam, true]
      }),
    });
    
    const blockResult = await blockResponse.json();
    if (blockResult.error || !blockResult.result) {
      return NextResponse.json(
        { error: blockResult.error?.message || 'Block not found' },
        { status: 404 }
      );
    }
    
    // Use the first transaction in the block, or if no transactions, we can't use storage range
    if (!blockResult.result.transactions || blockResult.result.transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions in block, cannot use debug_storageRangeAt' },
        { status: 400 }
      );
    }
    
    const txHash = blockResult.result.transactions[0].hash;
    
    // Now get a transaction index within the block
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash]
      }),
    });
    
    const txResult = await txResponse.json();
    if (txResult.error || !txResult.result) {
      return NextResponse.json(
        { error: txResult.error?.message || 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Call the debug_storageRangeAt RPC method
    // Parameters: [blockHash, txIndex, contractAddress, startKey, maxResults]
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'debug_storageRangeAt',
        params: [
          blockResult.result.hash,
          parseInt(txResult.result.transactionIndex, 16),
          address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          100 // Limit number of storage slots
        ]
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const storageResult = await response.json();
    
    // Check for RPC errors
    if (storageResult.error) {
      console.error('RPC error when getting storage:', storageResult.error);
      return NextResponse.json(
        { error: storageResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    // Format the storage data for display
    const { storage, nextKey } = storageResult.result;
    const storageMap: Record<string, { key: string; value: string }> = {};
    
    if (storage && typeof storage === 'object') {
      Object.entries(storage).forEach(([key, data]: [string, unknown]) => {
        // Type guard to check if 'data' has the expected structure
        if (typeof data === 'object' && data !== null && 'value' in data && typeof data.value === 'string') {
           storageMap[key] = {
             key, 
             value: data.value || 'NULL' 
           };
        } else {
           // Handle cases where the structure is unexpected
           console.warn(`Unexpected storage entry format for key ${key}:`, data);
           storageMap[key] = {
             key, 
             value: '[Unexpected Format]' 
           };
        }
      });
    }
    
    return NextResponse.json({
      address,
      blockNumber: blockParam,
      storageMap,
      nextKey
    });
  } catch (error) {
    console.error('Error getting contract storage:', error);
    return NextResponse.json(
      { error: 'Failed to get contract storage', message: (error as Error).message },
      { status: 500 }
    );
  }
}