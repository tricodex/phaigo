import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to securely trace a transaction using debug_traceTransaction RPC method
 * This prevents exposing API keys in client-side code
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
    
    // Call the debug_traceTransaction RPC method
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'debug_traceTransaction',
        params: [txHash, { tracer: 'callTracer' }]
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const traceResult = await response.json();
    
    // Check for RPC errors
    if (traceResult.error) {
      console.error('RPC error when tracing transaction:', traceResult.error);
      return NextResponse.json(
        { error: traceResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    // Extract useful information from the trace result
    const { result } = traceResult;
    
    // Transform the data for client consumption
    const traceData = {
      transactionHash: txHash,
      blockNumber: parseInt(result.blockNumber || '0', 16),
      stateChanges: result.calls || [],
      gasInfo: {
        gasUsed: result.gasUsed || '0',
        gasPrice: '0', // Not provided by callTracer
        gasExpectedUsage: '0', // Not provided by callTracer
      },
      status: result.error ? 'REVERT' : 'SUCCESS',
      error: result.error,
    };
    
    return NextResponse.json(traceData);
  } catch (error) {
    console.error('Error tracing transaction:', error);
    return NextResponse.json(
      { error: 'Failed to trace transaction', message: (error as Error).message },
      { status: 500 }
    );
  }
} 