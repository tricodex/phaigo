/**
 * URL helper utilities for safely creating complete URLs
 * Helps prevent "unsupported protocol" errors with ethers.js
 */

/**
 * Gets the base URL for the current environment (browser or server)
 * @returns The base URL (origin) to use for API requests
 */
export function getBaseUrl(): string {
  // In browser environments, use the current window location
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // In server-side environments, use a fallback URL
  // During SSR we'll use a default, which will be replaced client-side
  return 'http://localhost:3000';
}

/**
 * Creates a complete URL with protocol for ethers.js RPC endpoints
 * Prevents "unsupported protocol" errors by ensuring URLs have proper protocols
 * 
 * @param path The API path (should start with /)
 * @param params Optional query parameters object
 * @returns A complete URL string with protocol
 */
export function createRpcUrl(path: string, params?: Record<string, string>): string {
  const baseUrl = getBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Build the URL without query parameters first
  let url = `${baseUrl}${normalizedPath}`;
  
  // Add query parameters if provided
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value);
    });
    url += `?${searchParams.toString()}`;
  }
  
  return url;
} 