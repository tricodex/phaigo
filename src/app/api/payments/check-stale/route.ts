import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BlockchainTransactionSyncService } from '@/lib/services/blockchain/transaction-sync-service';
import { singleton } from '@/lib/utils/singleton';
import { ensureServerInitialized } from '@/lib/server-init';

const blockchainSyncService = singleton(BlockchainTransactionSyncService);

interface FixResult {
  id: string;
  txHash: string;
  wasFixed: boolean;
  error?: string;
}

/**
 * API endpoint to check and fix stuck payments
 * GET /api/payments/check-stale
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[CheckStale] Checking for stale payments...');
    
    // Ensure server services are initialized
    await ensureServerInitialized();
    
    // Get query parameters
    const hoursOld = parseInt(request.nextUrl.searchParams.get('hoursOld') || '2', 10);
    const network = request.nextUrl.searchParams.get('network') as 'mainnet' | 'sepolia' || 'sepolia';
    const txHash = request.nextUrl.searchParams.get('txHash');
    
    console.log(`[CheckStale] Parameters: hoursOld=${hoursOld}, network=${network}, txHash=${txHash || 'null'}`);
    
    // Initialize the blockchain sync service
    try {
      console.log(`[CheckStale] Initializing blockchain sync service for ${network} network`);
      await blockchainSyncService.initialize(network);
      console.log(`[CheckStale] Blockchain sync service initialized successfully`);
    } catch (initError) {
      console.error(`[CheckStale] Failed to initialize blockchain sync service:`, initError);
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize blockchain verification service',
        details: initError instanceof Error ? initError.message : 'Unknown initialization error'
      }, { status: 500 });
    }
    
    // If a specific transaction hash was provided, only check that one
    if (txHash) {
      console.log(`[CheckStale] Checking specific transaction: ${txHash}`);
      
      const payment = await prisma.payment.findUnique({
        where: { transactionHash: txHash },
        include: {
          sender: true,
          recipient: true
        }
      });
      
      if (!payment) {
        return NextResponse.json({
          success: false,
          error: `No payment found with transaction hash ${txHash}`
        }, { status: 404 });
      }
      
      console.log(`[CheckStale] Found payment: ID=${payment.id}, Status=${payment.status}, Amount=${payment.amount}`);
      
      if (payment.status === 'COMPLETED') {
        return NextResponse.json({
          success: true,
          message: 'Payment is already completed',
          payment
        });
      }
      
      const wasFixed = await blockchainSyncService.checkTransactionByHash(txHash, network);
      
      // Get the updated payment
      const updatedPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: {
          sender: true,
          recipient: true
        }
      });
      
      return NextResponse.json({
        success: true,
        wasFixed,
        oldStatus: payment.status,
        newStatus: updatedPayment?.status,
        payment: updatedPayment
      });
    }
    
    // Find all pending payments with transaction hashes older than the specified time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);
    
    const stalePayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        transactionHash: { not: null },
        createdAt: { lt: cutoffTime }
      },
      include: {
        sender: true,
        recipient: true
      }
    });
    
    console.log(`[CheckStale] Found ${stalePayments.length} stale payments`);
    
    // Process each payment
    const results: FixResult[] = [];
    
    for (const payment of stalePayments) {
      if (!payment.transactionHash) continue; // Skip if somehow no tx hash (shouldn't happen due to query)
      
      console.log(`[CheckStale] Checking payment ${payment.id} with tx ${payment.transactionHash}`);
      
      try {
        // Check the transaction
        const wasFixed = await blockchainSyncService.checkTransactionByHash(
          payment.transactionHash,
          network
        );
        
        results.push({
          id: payment.id,
          txHash: payment.transactionHash,
          wasFixed
        });
      } catch (error) {
        console.error(`[CheckStale] Error checking payment ${payment.id}:`, error);
        
        results.push({
          id: payment.id,
          txHash: payment.transactionHash,
          wasFixed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Get counts
    const fixed = results.filter(r => r.wasFixed).length;
    const failed = results.filter(r => !r.wasFixed).length;
    
    return NextResponse.json({
      success: true,
      totalChecked: results.length,
      fixed,
      failed,
      results
    });
  } catch (error) {
    console.error('[CheckStale] Error checking stale payments:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking stale payments'
    }, { status: 500 });
  }
} 