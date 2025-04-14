import { NextRequest, NextResponse } from 'next/server';
import { isValidNetwork } from '@/types/network';
import { getServerWsUrl } from '@/lib/config/server-env';

/**
 * API route to provide authenticated WebSocket connection details
 * This avoids exposing API keys in client-side code by creating a server-side proxy
 */
export async function GET(request: NextRequest) {
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
    
    // Get the WebSocket URL with API key from server environment
    const wsUrl = getServerWsUrl(network as 'mainnet' | 'sepolia');
    
    // Return the authenticated WebSocket URL
    // The client will use this URL to establish a WebSocket connection
    return NextResponse.json({ wsUrl });
  } catch (error) {
    console.error('Error generating WebSocket proxy URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate WebSocket connection' },
      { status: 500 }
    );
  }
} 