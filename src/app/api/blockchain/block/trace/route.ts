import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to trace block execution using trace_block RPC method
 * This demonstrates the use of GCP's computationally expensive methods
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    const blockNumber = searchParams.get('blockNumber') || 'latest';
    const filterPyusd = searchParams.get('filterPyusd') === 'true';
    
    // Validate parameters
    if (!network || !isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network specified' },
        { status: 400 }
      );
    }
    
    // Only available on mainnet for Ethereum
    if (network === 'sepolia') {
      return NextResponse.json(
        { error: 'trace_block is only available on Ethereum mainnet with GCP Blockchain RPC' },
        { status: 400 }
      );
    }
    
    // Get the secure RPC URL with API key
    const rpcUrl = getServerRpcUrl(network as 'mainnet' | 'sepolia');
    
    // Format block parameter
    const blockParam = blockNumber === 'latest' ? 'latest' : 
      blockNumber.startsWith('0x') ? blockNumber : `0x${parseInt(blockNumber).toString(16)}`;
    
    // Call the trace_block RPC method
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'trace_block',
        params: [blockParam]
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const traceResult = await response.json();
    
    // Check for RPC errors
    if (traceResult.error) {
      console.error('RPC error when tracing block:', traceResult.error);
      return NextResponse.json(
        { error: traceResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    // Get PYUSD contract address for the requested network
    const pyusdContractAddress = network === 'mainnet' 
      ? '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'.toLowerCase() 
      : '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'.toLowerCase();
    
    // Filter for PYUSD-related transactions if requested
    let pyusdTransactions = traceResult.result;
    
    // Define a type for the trace entry structure (simplified)
    type TraceEntry = {
      action: {
        to?: string;
        [key: string]: unknown; // Other action properties
      };
      result?: {
        address?: string;
        [key: string]: unknown; // Other result properties
      };
      [key: string]: unknown; // Other top-level properties
    };
    
    if (filterPyusd && Array.isArray(traceResult.result)) {
      pyusdTransactions = traceResult.result.filter((trace: TraceEntry) => {
        // Check if this transaction interacts with the PYUSD contract
        return (
          (trace.action?.to && trace.action.to.toLowerCase() === pyusdContractAddress) ||
          (trace.result?.address && trace.result.address.toLowerCase() === pyusdContractAddress)
        );
      });
    } else if (!Array.isArray(traceResult.result)) {
      // Handle cases where result is not an array
      console.warn("Trace result was not an array:", traceResult.result);
      pyusdTransactions = []; // Set to empty array if result is invalid
    }
    
    return NextResponse.json({
      blockNumber: blockParam,
      pyusdTransactionCount: pyusdTransactions.length,
      totalTransactionCount: traceResult.result.length,
      pyusdTransactions
    });
  } catch (error) {
    console.error('Error tracing block:', error);
    return NextResponse.json(
      { error: 'Failed to trace block', message: (error as Error).message },
      { status: 500 }
    );
  }
}