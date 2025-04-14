import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiAssistantService } from '@/lib/services/ai/ai-assistant-service';
import { serverEnv } from '@/lib/config/server-env';

// Schema for AI assistant requests
const assistantRequestSchema = z.object({
  message: z.string().min(1).max(1000),
});

// POST handler for AI assistant interactions
export async function POST(request: NextRequest) {
  console.log("AI assistant API route called");
  console.log("Request headers:", Object.fromEntries(request.headers.entries()));
  
  try {
    // Verify Gemini API key is configured
    if (!serverEnv.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json({ error: 'AI assistant service is not configured' }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Parse and validate request body
    const body = await request.json();
    console.log("Request body:", body);
    
    const validationResult = assistantRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues);
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validationResult.error.issues 
      }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Get wallet address from authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      console.error("Missing or invalid Authorization header:", authHeader);
      return NextResponse.json({ error: 'Authorization required' }, { 
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    const walletAddress = authHeader.replace('Wallet ', '');
    console.log("Wallet address:", walletAddress.slice(0, 8) + "...");
    
    // Process the message with the AI assistant service
    try {
      // Verify Gemini API key exists and isn't empty
      if (!serverEnv.GEMINI_API_KEY || serverEnv.GEMINI_API_KEY.trim() === '') {
        console.error('GEMINI_API_KEY is missing or empty');
        return NextResponse.json({ error: 'AI assistant service is not properly configured' }, { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }
      
      console.log("Creating AI assistant service with API key length:", serverEnv.GEMINI_API_KEY.length);
      const assistantService = aiAssistantService(serverEnv.GEMINI_API_KEY);
      console.log("Processing message:", validationResult.data.message);
      
      const response = await assistantService.processMessage(
        validationResult.data.message, 
        walletAddress
      );
      
      console.log("AI assistant response:", response);
      return NextResponse.json(response, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    } catch (error) {
      console.error('Error initializing or using AI assistant service:', error);
      return NextResponse.json(
        { error: 'Failed to process AI assistant request. Please try again later.' }, 
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in AI assistant API:', error);
    return NextResponse.json(
      { error: 'Failed to process AI assistant request' }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
