import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to fetch transaction details by hash
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    const txHash = searchParams.get('txHash');
    
    // Validate parameters
    if (!network || !isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network specified' },
        { status: 400 }
      );
    }
    
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash' },
        { status: 400 }
      );
    }
    
    // Get the secure RPC URL with API key
    const rpcUrl = getServerRpcUrl(network as 'mainnet' | 'sepolia');
    
    // Call the eth_getTransactionByHash RPC method
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
    
    // Process the response
    if (!txResponse.ok) {
      throw new Error(`HTTP error: ${txResponse.status} ${txResponse.statusText}`);
    }
    
    const txResult = await txResponse.json();
    
    // Check for RPC errors
    if (txResult.error) {
      console.error('RPC error when fetching transaction:', txResult.error);
      return NextResponse.json(
        { error: txResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    if (!txResult.result) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Get the block to get the timestamp
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByHash',
        params: [txResult.result.blockHash, false]
      }),
    });
    
    const blockResult = await blockResponse.json();
    
    // Get receipt for gas used
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      }),
    });
    
    const receiptResult = await receiptResponse.json();
    
    // Combine transaction data with block timestamp and receipt info
    const txData = {
      ...txResult.result,
      timestamp: blockResult.result ? parseInt(blockResult.result.timestamp, 16) : 0,
      gasUsed: receiptResult.result ? receiptResult.result.gasUsed : '0x0',
      status: receiptResult.result 
        ? (receiptResult.result.status === '0x1' ? 'Success' : 'Failed') 
        : 'Unknown'
    };
    
    return NextResponse.json(txData);
  } catch (error) {
    console.error('Error fetching transaction data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction data', message: (error as Error).message },
      { status: 500 }
    );
  }
}