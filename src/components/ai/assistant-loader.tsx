'use client';

import { useAccount } from 'wagmi';
import { Assistant } from './assistant';
import { useEffect, useState } from 'react';

/**
 * AssistantLoader Component
 * 
 * This component ensures that the Assistant is only rendered
 * after the wallet connection status is stable (connected) AND
 * the initial client-side hydration is complete.
 */
export function AssistantLoader() {
  const [isClientReady, setIsClientReady] = useState(false);
  const { status } = useAccount(); // Keep the hook call

  // Ensure we only render on the client after initial mount
  useEffect(() => {
    setIsClientReady(true);
    console.log("AssistantLoader: Client is ready.");
  }, []);

  // ---> MODIFIED LOGIC <----
  // 1. Wait for client to be ready before checking status
  if (!isClientReady) {
    // console.log("AssistantLoader: Client not ready, delaying render check.");
    return null; // Render nothing during SSR/hydration
  }

  // 2. Once client is ready, check connection status
  if (status !== 'connected') {
    // console.log(`AssistantLoader: Wallet not connected (status: ${status}), delaying Assistant render.`);
    return null; // Render nothing if not connected
  }

  // 3. Client is ready AND wallet is connected
  console.log("AssistantLoader: Client ready and wallet connected. Rendering Assistant.");
  return <Assistant />;
}