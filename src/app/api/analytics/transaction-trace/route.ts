import { NextRequest, NextResponse } from 'next/server';
import { Network, isValidNetwork } from '@/types/network';
import { PyusdAnalyticsService } from '@/lib/services/blockchain/analytics';
import { singleton } from '@/lib/utils/singleton';

const analyticsService = singleton(PyusdAnalyticsService); 

/**
 * GET /api/analytics/transaction-trace
 * Fetch detailed trace data for a specific transaction using debug_traceTransaction
 * Leverages GCP Blockchain RPC's free access to computationally expensive methods
 */
export async function GET(request: NextRequest) { 
  try {
    // Parse query parameters
    const url = new URL(request.url);
    
    // Get transaction hash parameter
    const txHash = url.searchParams.get('txHash');
    if (!txHash) {
      return NextResponse.json(
        { error: 'Missing txHash parameter' },
        { status: 400 }
      );
    }
    
    // Get network parameter, default to mainnet if not specified
    const network = url.searchParams.get('network') || 'mainnet';
    if (!isValidNetwork(network)) {
      return NextResponse.json(
        { error: `Invalid network: ${network}` },
        { status: 400 }
      );
    }
    
    // Get transaction trace data
    const traceData = await analyticsService.getTransactionTrace(txHash, network as Network);
    
    if (!traceData) {
      return NextResponse.json(
        { error: 'Failed to retrieve transaction trace or transaction not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(traceData);
  } catch (error) {
    console.error('Error in transaction trace API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
