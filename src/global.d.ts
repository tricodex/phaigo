interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    selectedAddress?: string;
    networkVersion?: string;
    chainId?: string;
  };
}

// Add EIP-1193 Ethereum Provider types
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  selectedAddress?: string;
  networkVersion?: string;
  chainId?: string;
} 