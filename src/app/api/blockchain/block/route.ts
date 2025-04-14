import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to fetch block data by number or hash
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    const blockNumber = searchParams.get('blockNumber');
    const blockHash = searchParams.get('blockHash');
    
    // Validate parameters
    if (!network || !isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network specified' },
        { status: 400 }
      );
    }
    
    if (!blockNumber && !blockHash) {
      return NextResponse.json(
        { error: 'Either blockNumber or blockHash must be provided' },
        { status: 400 }
      );
    }
    
    // Get the secure RPC URL with API key
    const rpcUrl = getServerRpcUrl(network as 'mainnet' | 'sepolia');
    
    // Call the appropriate Ethereum JSON-RPC method based on parameters
    const method = blockHash ? 'eth_getBlockByHash' : 'eth_getBlockByNumber';
    const params = blockHash 
      ? [blockHash, true] 
      : [blockNumber === 'latest' ? 'latest' : `0x${parseInt(blockNumber || '0').toString(16)}`, true];
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Check for RPC errors
    if (result.error) {
      console.error('RPC error when fetching block:', result.error);
      return NextResponse.json(
        { error: result.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result.result);
  } catch (error) {
    console.error('Error fetching block data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch block data', message: (error as Error).message },
      { status: 500 }
    );
  }
}