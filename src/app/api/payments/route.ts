import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { userService } from '@/lib/services/users/user-service';
import { ensureServerInitialized } from '@/lib/server-init';

// Create a new payment record (but don't confirm it yet)
export async function POST(request: NextRequest) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();

    // Parse request body
    const body = await request.json();
    const { senderWalletAddress, recipientUsername, amount, notes, requestId, transactionHash } = body;

    // Extract wallet address from Authorization header (if present)
    const authHeader = request.headers.get('Authorization') || '';
    const authWalletAddress = authHeader.startsWith('Wallet ') 
      ? authHeader.slice(7) // Remove 'Wallet ' prefix
      : '';

    // Use the wallet address from the Authorization header if available
    const effectiveWalletAddress = authWalletAddress || senderWalletAddress;

    // Validate required fields
    if (!effectiveWalletAddress) {
      return NextResponse.json(
        { error: 'Sender wallet address is required' },
        { status: 400 }
      );
    }

    if (!recipientUsername) {
      return NextResponse.json(
        { error: 'Recipient username is required' },
        { status: 400 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { error: 'Payment amount is required' },
        { status: 400 }
      );
    }

    // Get recipient user for wallet access
    const recipient = await userService.getUserByUsername(recipientUsername);
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Add requiredConfirmation flag to ensure the client triggers wallet UI
    const shouldRequireConfirmation = true;

    // Create a payment record
    // The actual blockchain transaction will be done on the client side
    // and the transaction hash will be submitted later
    const result = await paymentService.createPayment({
      senderWalletAddress: effectiveWalletAddress,
      recipientUsername,
      amount,
      notes,
      requestId,
      transactionHash,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    // Return the created payment record along with recipient info for blockchain transaction
    return NextResponse.json({ 
      payment: result.payment,
      recipientAddress: recipient.walletAddress,
      requiredConfirmation: shouldRequireConfirmation,
      message: 'Payment initialized. Please complete the blockchain transaction.'
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get payments by various filters
export async function GET(request: NextRequest) {
  try {
    const txHash = request.nextUrl.searchParams.get('txHash');
    const walletAddress = request.nextUrl.searchParams.get('walletAddress');
    const limit = Number(request.nextUrl.searchParams.get('limit') || '10');
    
    // Get payment by transaction hash
    if (txHash) {
      const payment = await paymentService.getPaymentByTransactionHash(txHash);
      
      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }
      
      return NextResponse.json({ payment });
    }
    
    // Get payments for a wallet address
    if (walletAddress) {
      // First get the user ID
      const user = await userService.getUserByWalletAddress(walletAddress);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Get payment history with type field added
      const rawPayments = await userService.getUserPaymentHistory(user.id);
      
      // Add a "type" field to each payment to indicate sent/received
      const payments = rawPayments.slice(0, limit).map(payment => {
        const isSender = payment.senderId === user.id;
        return {
          ...payment,
          type: isSender ? 'sent' : 'received'
        };
      });
      
      return NextResponse.json({ payments });
    }
    
    // If no filters provided
    return NextResponse.json({ error: 'A filter must be provided' }, { status: 400 });
  } catch (error) {
    console.error('Error getting payments:', error);
    return NextResponse.json({ 
      error: 'Failed to get payments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
