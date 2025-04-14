"use client";

import { useState, useEffect } from 'react';

/**
 * Hook to detect if the current device is mobile
 * using window.innerWidth and a breakpoint (default: 768px)
 */
export function useIsMobile(breakpoint = 768): boolean {
  // Default to false for SSR
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted to true to indicate we're in the browser
    setMounted(true);
    
    // Update isMobile based on window width
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    
    // Check immediately
    checkMobile();
    
    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  // If not mounted yet (SSR), return false
  if (!mounted) return false;
  
  return isMobile;
}

export default useIsMobile; 