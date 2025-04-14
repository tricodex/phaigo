import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/services/payments/payment-service';
import { userService } from '@/lib/services/users/user-service';
import { z } from 'zod';

// Schema for creating a payment request
const createRequestSchema = z.object({
  amount: z.string().min(1),
  notes: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

// Create a new payment request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 });
    }
    
    // Verify user through authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const walletAddress = authHeader.replace('Wallet ', '');
    
    // Get or create user
    const user = await userService.findOrCreateUser(walletAddress);
    
    // Create payment request
    const paymentRequest = await paymentService.createPaymentRequest(
      user.id,
      validation.data.amount,
      validation.data.notes,
      validation.data.expiresAt ? new Date(validation.data.expiresAt) : undefined
    );
    
    return NextResponse.json({ request: paymentRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment request:', error);
    return NextResponse.json({ error: 'Failed to create payment request' }, { status: 500 });
  }
}

// Get open payment requests or user requests
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.nextUrl.searchParams.get('walletAddress');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    
    // If wallet address provided, get user's requests
    if (walletAddress) {
      // Get user
      const user = await userService.getUserByWalletAddress(walletAddress);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Get user's requests
      const requests = await userService.getUserRequests(user.id);
      
      return NextResponse.json({ requests });
    }
    
    // Otherwise get open requests
    const openRequests = await paymentService.getOpenPaymentRequests(limit);
    
    return NextResponse.json({ requests: openRequests });
  } catch (error) {
    console.error('Error getting payment requests:', error);
    return NextResponse.json({ error: 'Failed to get payment requests' }, { status: 500 });
  }
}
