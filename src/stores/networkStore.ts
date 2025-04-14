import { create } from 'zustand';
import { Network } from '@/types/network';

interface NetworkState {
  currentNetwork: Network;
  setCurrentNetwork: (network: Network) => void;
}

// Default to Sepolia, but components can update this
const DEFAULT_NETWORK: Network = 'sepolia';

export const useNetworkStore = create<NetworkState>((set) => ({
  currentNetwork: DEFAULT_NETWORK, 
  setCurrentNetwork: (network: Network) => set({ currentNetwork: network }),
})); 