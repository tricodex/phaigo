import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';

/**
 * API route to get contract bytecode using eth_getCode RPC method
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
    
    // Format block parameter
    const blockParam = blockNumber === 'latest' ? 'latest' : 
      blockNumber.startsWith('0x') ? blockNumber : `0x${parseInt(blockNumber).toString(16)}`;
    
    // Call the eth_getCode RPC method
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, blockParam]
      }),
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const codeResult = await response.json();
    
    // Check for RPC errors
    if (codeResult.error) {
      console.error('RPC error when getting contract code:', codeResult.error);
      return NextResponse.json(
        { error: codeResult.error.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }
    
    // Get ABI if this is the PYUSD contract
    let abiInfo = null;
    const isPyusdContract = address.toLowerCase() === (network === 'mainnet' 
      ? '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8' 
      : '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9').toLowerCase();
    
    if (isPyusdContract) {
      abiInfo = {
        name: 'PYUSD',
        description: 'PayPal USD Stablecoin ERC-20 Contract',
        standard: 'ERC-20',
        sourceUrl: 'https://github.com/paxos-std/pyusd-contract'
      };
    }
    
    const result = {
      address,
      code: codeResult.result,
      isContract: codeResult.result !== '0x',
      blockNumber: blockParam,
      abiInfo
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting contract code:', error);
    return NextResponse.json(
      { error: 'Failed to get contract code', message: (error as Error).message },
      { status: 500 }
    );
  }
}