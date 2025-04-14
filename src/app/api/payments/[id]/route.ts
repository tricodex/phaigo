import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { ensureServerInitialized } from '@/lib/server-init';

// Get a payment by ID
export async function GET(
  request: NextRequest,
) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();

    // Get payment ID from URL params
    const id = request.nextUrl.pathname.split('/')[3];

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Get the payment by ID
    const payment = await paymentService.getPaymentById(id);

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Return the payment data
    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Error getting payment by ID:', error);
    return NextResponse.json(
      {
        error: 'Failed to get payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Update a payment (mark as failed)
export async function PATCH(
  request: NextRequest,
) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();

    // Get payment ID from URL params
    const id = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();
    const { action } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Extract wallet address from Authorization header (required for security)
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Wallet ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }
    
    const walletAddress = authHeader.slice(7); // Remove 'Wallet ' prefix

    if (action === 'cancel') {
      // Cancel a pending payment
      const result = await paymentService.cancelPayment(id, walletAddress);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ 
        payment: result.payment,
        message: 'Payment cancelled successfully'
      });
    }
    
    // Invalid action
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to update payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 