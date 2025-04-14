import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerRpcUrl } from '@/lib/config/server-env';
import { clientEnv } from '@/lib/config/env';

export const runtime = 'nodejs';

// JSON-RPC request type definition
type JsonRpcRequest = {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

/**
 * API route to proxy RPC calls to GCP Blockchain RPC service
 * This allows us to make authenticated requests without exposing API keys in client-side code
 */
export async function POST(request: NextRequest) {
  try {
    // Get the network from the query string
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network');
    
    // Validate the network
    if (!network || !isValidNetwork(network)) {
      return NextResponse.json(
        { error: 'Invalid network specified' },
        { status: 400 }
      );
    }
    
    // Get the RPC URL with API key from server environment
    const rpcUrl = getServerRpcUrl(network as 'mainnet' | 'sepolia');
    
    // Get the RPC request payload from the request body
    let rpcRequest: JsonRpcRequest;
    let requestId: number | string | null = null;
    
    try {
      // Handle empty bodies by creating a minimal valid JSON-RPC request
      const body = await request.text();
      
      if (!body || body.trim() === '' || body === '{}') {
        // Create a default request for eth_blockNumber if no body is provided
        // This handles the case where ethers.js is checking connection
        rpcRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: []
        };
        console.log('Empty request body received, using default eth_blockNumber request');
      } else {
        try {
          rpcRequest = JSON.parse(body);
        } catch (error) {
          console.error('Failed to parse JSON request body:', body, error);
          // Use a default request even for malformed JSON
          rpcRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_blockNumber',
            params: []
          };
        }
      }
      
      // Store the original request ID to ensure we return the same ID
      requestId = rpcRequest.id ?? 1;
      
      // Ensure the request is a valid JSON-RPC request
      rpcRequest = normalizeJsonRpcRequest(rpcRequest);
      
      // Make sure we preserve the original request ID
      rpcRequest.id = requestId;
      
      // Always treat requests as valid - ethers.js needs this
      // Instead of rejecting invalid requests, we'll normalize them
    } catch (jsonError) {
      console.error('Error handling JSON request:', jsonError);
      // Even on error, provide a valid response with a default request
      rpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      };
      requestId = 1;
    }
    
    // Forward the request to the actual RPC endpoint with API key
    let response;
    try {
      response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpcRequest),
      });
    } catch (fetchError) {
      console.error('Error fetching from RPC provider:', fetchError);
      return NextResponse.json(
        createJsonRpcError('Internal error: Provider unavailable', -32603, requestId),
        { status: 502 }
      );
    }
    
    if (!response.ok) {
      console.warn(`RPC provider returned ${response.status}: ${response.statusText}`);
      // Try fallback if primary provider fails
      return await tryFallbackProvider(network, rpcRequest);
    }
    
    // Parse the response from the RPC endpoint
    const rpcResponse = await response.json();
    
    // Handle both array responses and single object responses
    if (Array.isArray(rpcResponse)) {
      // For batch requests, ensure all responses have the correct ID matching their request
      const fixedResponses = rpcResponse;
      
      // If we have an array response but the request was not an array,
      // this is likely a batch response to a single request
      if (!Array.isArray(rpcRequest)) {
        // Match response IDs with the original request ID
        return NextResponse.json(
          fixedResponses.map(response => ({ ...response, id: rpcRequest.id }))
        );
      }
      
      return NextResponse.json(fixedResponses);
    } else {
      // For single response, ensure it has the correct ID
      if (rpcResponse.id !== requestId) {
        rpcResponse.id = requestId;
      }
      
      return NextResponse.json(rpcResponse);
    }
  } catch (error) {
    console.error('Error proxying RPC request:', error);
    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: { 
          code: -32603, 
          message: 'Internal error: ' + (error instanceof Error ? error.message : 'Unknown error') 
        },
        id: null 
      },
      { status: 500 }
    );
  }
}

/**
 * Ensure the request object has the required JSON-RPC fields
 * This normalizes incomplete requests to valid JSON-RPC format
 */
function normalizeJsonRpcRequest(request: Record<string, unknown>): JsonRpcRequest {
  // Handle case where request might be completely malformed
  if (!request || typeof request !== 'object') {
    return {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: []
    };
  }
  
  const normalized: JsonRpcRequest = {
    jsonrpc: typeof request.jsonrpc === 'string' ? request.jsonrpc : '2.0',
    id: typeof request.id !== 'undefined' ? (request.id as number | string | null) : Math.floor(Math.random() * 1000),
    method: typeof request.method === 'string' ? request.method : 'eth_blockNumber',
    params: Array.isArray(request.params) ? request.params : 
            (typeof request.params === 'object' && request.params !== null) ? 
            request.params as Record<string, unknown> : []
  };
  
  return normalized;
}

/**
 * Create a JSON-RPC 2.0 error response
 */
function createJsonRpcError(message: string, code: number, id: string | number | null) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message
    },
    id
  };
}

/**
 * Try using a fallback provider if the GCP RPC fails
 */
async function tryFallbackProvider(network: string, body: JsonRpcRequest) {
  try {
    const fallbacks: Record<string, string> = {
      mainnet: clientEnv.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_MAINNET || 'https://ethereum.rpc.thirdweb.com',
      sepolia: clientEnv.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_SEPOLIA || 'https://ethereum-sepolia.rpc.thirdweb.com',
    };
    
    const fallbackUrl = fallbacks[network as keyof typeof fallbacks];
    if (!fallbackUrl) {
      return NextResponse.json(
        createJsonRpcError('No fallback provider available', -32603, body.id),
        { status: 502 }
      );
    }
    
    console.log(`Using fallback provider for ${network}:`, fallbackUrl);
    
    const response = await fetch(fallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        createJsonRpcError('Fallback provider request failed', -32603, body.id),
        { status: 502 }
      );
    }
    
    const data = await response.json();
    
    // Handle both array responses and single object responses from fallback
    if (Array.isArray(data)) {
      // For batch requests, ensure all responses have the correct ID matching their request
      // If we have an array response but the request was not an array,
      // this is likely a batch response to a single request
      if (!Array.isArray(body)) {
        // Match response IDs with the original request ID
        return NextResponse.json(
          data.map(response => ({ ...response, id: body.id }))
        );
      }
      
      return NextResponse.json(data);
    } else {
      // For single response, ensure it has the correct ID
      if (data.id !== body.id) {
        data.id = body.id;
      }
      
      return NextResponse.json(data);
    }
  } catch (fallbackError) {
    console.error('Fallback provider also failed:', fallbackError);
    return NextResponse.json(
      createJsonRpcError(
        'All providers failed: ' + (fallbackError instanceof Error ? fallbackError.message : 'Unknown error'),
        -32603,
        body.id
      ),
      { status: 502 }
    );
  }
}