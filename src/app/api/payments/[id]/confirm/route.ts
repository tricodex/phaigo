import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { ensureServerInitialized } from '@/lib/server-init';
import { BlockchainTransactionSyncService } from '@/lib/services/blockchain/transaction-sync-service';
import { singleton } from '@/lib/utils/singleton';

// Create singleton instance of blockchain sync service
const blockchainSyncService = singleton(BlockchainTransactionSyncService);

/**
 * API route to confirm a payment with a transaction hash
 * POST /api/payments/[id]/confirm
 */
export async function POST(
  request: NextRequest,
) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();
    
    // Get payment ID from URL params
    const paymentId = request.nextUrl.pathname.split('/')[3];
    
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }
    
    // Get authentication from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Wallet authentication required' },
        { status: 401 }
      );
    }
    
    // Extract wallet address
    const walletAddress = authHeader.slice(7);
    
    // Parse request body
    const body = await request.json();
    
    // Check that we have a transaction hash
    if (!body.transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }
    
    // Get additional options if present
    const forceCheck = !!body.forceCheck;
    
    // Confirm the payment with the transaction hash
    const result = await paymentService.confirmPayment(
      paymentId,
      body.transactionHash,
      walletAddress,
      { forceCheck }
    );
    
    // If force checking is requested, use the blockchain sync service
    if (forceCheck && result.success && blockchainSyncService) {
      try {
        // Initialize blockchain sync service if not already
        if (!blockchainSyncService.isInitialized) {
          await blockchainSyncService.initialize();
        }
        
        // Force check the transaction status 
        await blockchainSyncService.checkTransactionByHash(body.transactionHash);
      } catch (error) {
        console.error('Error force checking transaction:', error);
        // Continue with normal flow even if force check fails
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error confirming payment:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      } else if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}

// Mark a payment as failed
export async function PATCH(
  request: NextRequest,
) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();
    
    // Get payment ID from URL params
    const id = request.nextUrl.pathname.split('/')[3];
    
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }
    
    // Mark the payment as failed
    // NOTE: This should ideally only be used for client-side errors
    // Actual blockchain failures should be detected by the sync service
    const result = await paymentService.failPayment(id);
    
    // Handle the result based on success status
    if (!result.success) {
      // Return appropriate error code and message
      let statusCode = 400;
      
      if (result.code === 'PAYMENT_NOT_FOUND') {
        statusCode = 404;
      }
      
      return NextResponse.json({ 
        error: result.error,
        code: result.code
      }, { status: statusCode });
    }
    
    // Success - return the updated payment
    return NextResponse.json({ payment: result.payment });
  } catch (error) {
    console.error('Error marking payment as failed:', error);
    return NextResponse.json({ 
      error: 'Failed to update payment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
