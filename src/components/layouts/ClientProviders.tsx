'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Import Providers dynamically with SSR disabled to prevent hydration issues
const DynamicProviders = dynamic(
  () => import('@/app/providers').then(mod => mod.Providers),
  { ssr: false }
);

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * ClientProviders - A client component that loads Providers with dynamic import
 * This avoids the "ssr: false is not allowed in Server Components" error
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return <DynamicProviders>{children}</DynamicProviders>;
}

export default ClientProviders; 