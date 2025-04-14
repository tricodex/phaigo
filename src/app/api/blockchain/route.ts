import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Handler for blockchain API routes
 * This route handles blockchain-related API calls and routes them to the appropriate subhandler
 */
export async function GET(request: NextRequest) {
  try {
    const { pathname, search, searchParams } = request.nextUrl;
    
    // Check if this is a PYUSD request
    const isPyusdRequest = searchParams.has('address') && 
                          (pathname.endsWith('/blockchain') || 
                           pathname.endsWith('/blockchain/pyusd'));
    
    if (isPyusdRequest) {
      // Forward to the PYUSD handler
      // Make a new internal request to the correct endpoint
      const pyusdUrl = new URL('/api/blockchain/pyusd', request.url);
      
      // Copy all search params
      searchParams.forEach((value, key) => {
        pyusdUrl.searchParams.set(key, value);
      });
      
      // Handle the request internally
      const pyusdResponse = await fetch(pyusdUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true'
        }
      });

      // Read the body and create a new response
      if (pyusdResponse.ok) {
        const data = await pyusdResponse.json();
        // Ensure Content-Type is correctly set for the final response
        return NextResponse.json(data, { 
          status: pyusdResponse.status,
          headers: { 'Content-Type': 'application/json' } 
        });
      } else {
        // Forward the error response body if possible
        let errorData = { error: 'Internal PYUSD handler failed' };
        try {
          errorData = await pyusdResponse.json();
        } catch { /* Ignore parsing error if body is not JSON */ }
        
        return NextResponse.json(errorData, { 
          status: pyusdResponse.status,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // If no handler matched, return a 404
    return NextResponse.json(
      { error: `Route not found: ${pathname}${search}` },
      { status: 404 }
    );
  } catch (error) {
    console.error(`Error in blockchain API route:`, error);
    return NextResponse.json(
      { error: 'Unexpected error in blockchain API', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 