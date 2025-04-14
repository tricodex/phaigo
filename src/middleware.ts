import { NextResponse, NextRequest } from 'next/server';
import { isDevelopment, isProduction } from './lib/config/environment';

// List of allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://phaigo.com',
  'https://phaigo.vercel.app',
  'https://phaigo.xyz',
  'https://www.phaigo.xyz',
  'https://www.phaigo.com',
  'https://www.phaigo.vercel.app',
  // Add your production domains here
];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Get the origin from the request
    const origin = request.headers.get('origin') || '';
    
    // Check if the origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin) || isDevelopment;
    
    // Set CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Origin',
      isAllowedOrigin ? origin : allowedOrigins[0]
    );
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
    
    // Handle OPTIONS request (preflight)
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }
  }
  
  // Add security headers for all routes
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for production
  if (isProduction) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss:;"
    );
  }
  
  return response;
}

// Configure the middleware to run on specific routes
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to all HTML pages
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};
