import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { userService } from '@/lib/services/users/user-service';

// Get request by ID
export async function GET(
  request: NextRequest,
) {
  try {
    // Get request ID from URL params
    const requestId = request.nextUrl.pathname.split('/')[3];
    
    // Get payment request
    const paymentRequest = await paymentService.getRequestById(requestId);
    
    if (!paymentRequest) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }
    
    return NextResponse.json({ request: paymentRequest });
  } catch (error) {
    console.error('Error getting payment request:', error);
    return NextResponse.json({ error: 'Failed to get payment request' }, { status: 500 });
  }
}

// Cancel request
export async function PATCH(
  request: NextRequest,
) {
  try {
    // Get request ID from URL params
    const requestId = request.nextUrl.pathname.split('/')[3];
    const { action } = await request.json();
    
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // Verify user through authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const walletAddress = authHeader.replace('Wallet ', '');
    
    // Get user
    const user = await userService.getUserByWalletAddress(walletAddress);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Cancel payment request
    const canceledRequest = await paymentService.cancelPaymentRequest(requestId, user.id);
    
    return NextResponse.json({ request: canceledRequest });
  } catch (error) {
    console.error('Error canceling payment request:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('not authorized')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('already')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: 'Failed to cancel payment request' }, { status: 500 });
  }
}
