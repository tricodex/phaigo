/**
 * Type definitions for Ethereum provider in browser window object
 */

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isWalletConnect?: boolean;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  request: (request: { method: string; params?: any[] }) => Promise<any>;
}

interface Window {
  ethereum?: EthereumProvider;
} 