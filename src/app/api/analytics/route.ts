import { NextRequest, NextResponse } from 'next/server';
import { Network, isValidNetwork } from '@/types/network';
import { PyusdAnalyticsService } from '@/lib/services/blockchain/analytics';
import { singleton } from '@/lib/utils/singleton';

const analyticsService = singleton(PyusdAnalyticsService);

/**
 * GET /api/analytics
 * Fetch PYUSD analytics data based on query parameters
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    
    // Get network parameter, default to mainnet if not specified
    const network = url.searchParams.get('network') || 'mainnet';
    if (!isValidNetwork(network)) {
      return NextResponse.json(
        { error: `Invalid network: ${network}` },
        { status: 400 }
      );
    }
    
    // Get dataType parameter
    const dataType = url.searchParams.get('dataType');
    if (!dataType) {
      return NextResponse.json(
        { error: 'Missing dataType parameter' },
        { status: 400 }
      );
    }
    
    let result;
    
    switch (dataType) {
      case 'marketData':
        result = await analyticsService.getTokenMarketData(network as Network);
        break;
        
      case 'topHolders':
        const limit = parseInt(url.searchParams.get('limit') || '10');
        result = await analyticsService.getTopHolders(network as Network, limit);
        break;
        
      case 'recentTransactions':
        const txLimit = parseInt(url.searchParams.get('limit') || '10');
        result = await analyticsService.getRecentTransactions(network as Network, txLimit);
        break;
        
      case 'networkCongestion':
        const blocks = parseInt(url.searchParams.get('blocks') || '10');
        result = await analyticsService.getNetworkCongestion(network as Network, blocks);
        break;
        
      case 'contractActivity':
        const activityLimit = parseInt(url.searchParams.get('limit') || '20');
        result = await analyticsService.getContractActivity(network as Network);
        break;
        
      case 'historicalData':
        const historyType = url.searchParams.get('historyType') as 'volume' | 'transfers' | 'holders' || 'volume';
        const days = parseInt(url.searchParams.get('days') || '30');
        result = await analyticsService.getHistoricalData(network as Network, historyType, days);
        break;
        
      default:
        return NextResponse.json(
          { error: `Invalid dataType: ${dataType}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analytics API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
