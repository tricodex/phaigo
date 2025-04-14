'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ConnectWallet } from '@/components/ui/connect-wallet';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { useNetworkStore } from '@/stores/networkStore';

interface HeaderProps {
  sticky?: boolean;
  transparent?: boolean;
}

/**
 * Header - A reusable header component with logo and wallet connection
 * @param sticky - Whether the header should be sticky (defaults to true)
 * @param transparent - Whether the header should have transparent background (defaults to false)
 */
export function Header({ sticky = true, transparent = false }: HeaderProps) {
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const setCurrentNetwork = useNetworkStore((state) => state.setCurrentNetwork);
  
  // Get the background class based on props
  const getBgClass = () => {
    if (transparent) return 'bg-background/95 backdrop-blur-sm';
    return 'bg-white';
  };
  
  // Get the header classes based on props
  const getHeaderClasses = () => {
    return `border-b py-4 ${sticky ? 'sticky top-0 z-10' : ''} ${getBgClass()}`;
  };
  
  return (
    <header className={getHeaderClasses()}>
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />
          <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <NetworkStatus currentNetwork={currentNetwork} onNetworkChange={setCurrentNetwork} />
          <ConnectWallet size="sm" showAddress={true} />
        </div>
      </div>
    </header>
  );
}

export default Header; 