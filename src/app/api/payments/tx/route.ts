import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { singleton } from '@/lib/utils/singleton';
import { BlockchainTransactionSyncService } from '@/lib/services/blockchain/transaction-sync-service';
import { ensureServerInitialized } from '@/lib/server-init';

const blockchainSyncService = singleton(BlockchainTransactionSyncService);

/**
 * GET /api/payments/tx
 * Query payment by transaction hash and optionally force-check its status
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();
    
    // Get transaction hash from query parameters
    const searchParams = request.nextUrl.searchParams;
    const txHash = searchParams.get('hash');
    const forceCheck = searchParams.get('forceCheck') === 'true';
    const network = searchParams.get('network') || 'sepolia';
    
    if (!txHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }
    
    // Find the payment with this transaction hash
    const payment = await paymentService.getPaymentByTransactionHash(txHash);
    
    // If we need to force check the transaction status
    if (forceCheck && payment && payment.status !== 'COMPLETED') {
      try {
        // Initialize blockchain sync service if not already
        await blockchainSyncService.initialize();
        
        // Force check the transaction status
        const isConfirmed = await blockchainSyncService.checkTransactionByHash(
          txHash, 
          network === 'mainnet' ? 'mainnet' : 'sepolia'
        );
        
        // If we successfully confirmed the payment, get the updated payment record
        if (isConfirmed) {
          const updatedPayment = await paymentService.getPaymentByTransactionHash(txHash);
          
          return NextResponse.json({
            payment: updatedPayment,
            checked: true,
            confirmed: true
          });
        }
        
        // Transaction exists but not yet confirmed
        return NextResponse.json({
          payment,
          checked: true,
          confirmed: false
        });
      } catch (error) {
        console.error('Error force-checking transaction:', error);
        // Continue with normal flow even if force check fails
      }
    }
    
    // Payment not found or no force check requested
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found for this transaction hash' },
        { status: 404 }
      );
    }
    
    // Return the payment data
    return NextResponse.json({ 
      payment,
      checked: forceCheck,
      confirmed: payment.status === 'COMPLETED'
    });
  } catch (error) {
    console.error('Error checking payment by transaction hash:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check payment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 