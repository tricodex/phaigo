import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { serverEnv } from '@/lib/config/server-env';
import { aiAssistantService } from '@/lib/services/ai/ai-assistant-service';

/**
 * GET handler for debugging the AI assistant configuration
 * This endpoint checks if all required API keys and environment variables are properly set
 * and attempts to make a test request to the Gemini API to verify connectivity
 */
export async function GET() {
  // Only available in development mode for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Debug endpoint not available in production' }, { status: 403 });
  }

  const debug = {
    environment: process.env.NODE_ENV,
    geminiApiKey: {
      exists: Boolean(serverEnv.GEMINI_API_KEY),
      isEmpty: serverEnv.GEMINI_API_KEY ? serverEnv.GEMINI_API_KEY.trim() === '' : true,
      // Don't return the actual key for security reasons
      firstChar: serverEnv.GEMINI_API_KEY ? serverEnv.GEMINI_API_KEY.charAt(0) : 'n/a',
      length: serverEnv.GEMINI_API_KEY ? serverEnv.GEMINI_API_KEY.length : 0
    },
    apiTest: { success: false, error: null as string | null }
  };

  // Test the Gemini API with a simple request
  if (debug.geminiApiKey.exists && !debug.geminiApiKey.isEmpty) {
    try {
      const genAI = new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY });
      const model = genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Testing Gemini API connectivity. Respond with 'Connected'.",
      });

      const result = await model;
      debug.apiTest.success = result && result.text ? result.text.includes('Connected') : false;
    } catch (error) {
      debug.apiTest.success = false;
      debug.apiTest.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return NextResponse.json(debug);
}

/**
 * POST handler for testing the full AI assistant service
 * This endpoint processes a test message through the AI assistant service
 * and returns the full response with detailed debugging information
 */
export async function POST(request: NextRequest) {
  // Only available in development mode for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Debug endpoint not available in production' }, { status: 403 });
  }
  
  try {
    // Parse request body
    const body = await request.json();
    const message = body.message || "Hello";
    const walletAddress = body.walletAddress || "0x123456789abcdef123456789abcdef123456789";
    
    console.log("[DEBUG] Testing full AI assistant service with:");
    console.log("- Message:", message);
    console.log("- Wallet:", walletAddress);
    
    // Validate Gemini API key
    if (!serverEnv.GEMINI_API_KEY || serverEnv.GEMINI_API_KEY.trim() === '') {
      return NextResponse.json({ 
        error: 'Gemini API key not configured properly', 
        details: 'The API key is missing or empty' 
      }, { status: 500 });
    }
    
    try {
      // Initialize assistant service
      console.log("[DEBUG] Initializing AI assistant service...");
      const assistant = aiAssistantService(serverEnv.GEMINI_API_KEY);
      
      // Process the message
      console.log("[DEBUG] Processing message through assistant service...");
      const result = await assistant.processMessage(message, walletAddress);
      console.log("[DEBUG] Assistant service result:", result);
      
      return NextResponse.json({
        success: true,
        message,
        walletAddress,
        apiKeyLength: serverEnv.GEMINI_API_KEY.length,
        result
      });
    } catch (serviceError) {
      console.error("[DEBUG] Error in AI assistant service:", serviceError);
      return NextResponse.json({
        error: 'AI assistant service error',
        details: serviceError instanceof Error ? serviceError.message : String(serviceError),
        stack: serviceError instanceof Error ? serviceError.stack : undefined
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[DEBUG] Unexpected error in debug POST endpoint:", error);
    return NextResponse.json({
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 