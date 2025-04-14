import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { paymentService } from '@/lib/services/payments/payment-service';

// Schema for the request body
const recordHashSchema = z.object({
  paymentId: z.string().min(1, { message: 'Payment ID is required' }),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, { 
    message: 'Invalid transaction hash format' 
  }),
});

// POST handler for recording the transaction hash
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = recordHashSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('Invalid request body for /record-hash:', validationResult.error.issues);
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validationResult.error.issues 
      }, { status: 400 });
    }

    const { paymentId, transactionHash } = validationResult.data;
    console.log(`API /record-hash: Received request to record hash ${transactionHash} for payment ${paymentId}`);

    // Call the service to update the database
    const result = await paymentService.recordTransactionHash(paymentId, transactionHash);

    if (!result.success) {
      console.error(`API /record-hash: Failed to update hash for payment ${paymentId}:`, result.error);
      return NextResponse.json({ 
        error: result.error || 'Failed to record transaction hash' 
      }, { status: result.code === 'NOT_FOUND' ? 404 : 500 }); // Return 404 if payment not found
    }

    console.log(`API /record-hash: Successfully recorded hash for payment ${paymentId}`);
    // Return success response
    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Error in /api/payments/record-hash:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 