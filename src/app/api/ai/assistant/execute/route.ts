import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userService } from '@/lib/services/users/user-service';
import { paymentService } from '@/lib/services/payments/payment-service';

// Schema for send payment action
const sendPaymentSchema = z.object({
  action: z.literal('send_payment'),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().optional(),
});

// Schema for create payment request action
const createPaymentRequestSchema = z.object({
  action: z.literal('create_payment_request'),
  amount: z.string().min(1),
  description: z.string().optional(),
  expiresIn: z.number().optional(),
});

// Combined action schema
const actionSchema = z.discriminatedUnion('action', [
  sendPaymentSchema,
  createPaymentRequestSchema,
]);

// POST handler for executing AI assistant actions
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = actionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validationResult.error.issues 
      }, { status: 400 });
    }
    
    // Get wallet address from authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const walletAddress = authHeader.replace('Wallet ', '');
    
    // Execute the appropriate action based on the type
    switch (validationResult.data.action) {
      case 'send_payment': {
        // Prepare a payment transaction
        const { recipient, amount, description } = validationResult.data;
        
        // Normalize username by removing @ symbol if present
        const normalizedUsername = recipient.replace(/^@/, '');
        console.log(`Execute endpoint: Normalized username from "${recipient}" to "${normalizedUsername}"`);
        
        // Get recipient user to get their wallet address
        const recipientUser = await userService.getUserByUsername(normalizedUsername);
        if (!recipientUser) {
          console.log(`Execute endpoint: User "${normalizedUsername}" not found in database`);
          return NextResponse.json({ 
            error: `User @${normalizedUsername} not found` 
          }, { status: 404 });
        }
        
        console.log(`Execute endpoint: Found user "${normalizedUsername}" with wallet address ${recipientUser.walletAddress.slice(0, 8)}...`);
        
        // Create the payment in our database
        const result = await paymentService.createPayment({
          amount,
          notes: description,
          senderWalletAddress: walletAddress,
          recipientUsername: normalizedUsername,
        });
        
        if (!result.success) {
          return NextResponse.json({ 
            error: result.error || 'Failed to create payment', 
            code: result.code 
          }, { status: 400 });
        }
        
        // Return the payment details including transaction data needed for wallet signing
        return NextResponse.json({
          success: true,
          message: `Payment of ${amount} PYUSD to @${normalizedUsername} is ready for confirmation.`,
          payment: result.payment,
          transactionData: {
            recipientAddress: recipientUser.walletAddress,
            amount,
            description,
            needsWalletSignature: true
          },
          intent: 'pay'
        });
      }
      
      case 'create_payment_request': {
        // Create a payment request
        const { amount, description, expiresIn } = validationResult.data;
        
        // Get user by wallet address
        const user = await userService.getUserByWalletAddress(walletAddress);
        
        if (!user) {
          return NextResponse.json({ 
            error: 'User not found' 
          }, { status: 404 });
        }
        
        // Calculate expiry date if expiresIn is provided
        let expiresAt: Date | undefined = undefined;
        if (expiresIn) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiresIn);
        }
        
        // Create the request
        const request = await paymentService.createPaymentRequest(
          user.id,
          amount,
          description,
          expiresAt
        );
        
        // Return the request details with the ID
        return NextResponse.json({
          success: true,
          message: `Payment request for ${amount} PYUSD created successfully.`,
          request,
          requestId: request.id,
          intent: 'request'
        });
      }
      
      default:
        return NextResponse.json({ 
          error: 'Unsupported action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error executing AI assistant action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
