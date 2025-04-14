import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

// Add type declaration for our global blockchain setup
declare global {
  // eslint-disable-next-line no-var
  var blockchainSyncSetup: {
    mockTransactionConfirmation: (txHash: string) => {
      hash: string;
      wait: () => Promise<{ status: number; blockNumber: number }>;
    };
  };
}

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock the next/navigation for testing
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
  };
});

// Mock ethers for blockchain testing
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(123456),
      getBalance: vi.fn().mockResolvedValue(BigInt("1000000000000000000")),
    })),
  };
});

// Since we're using onchain synced DB as the single source of truth,
// we need to mock the blockchain data consistency
global.blockchainSyncSetup = {
  mockTransactionConfirmation: (txHash: string) => {
    return {
      hash: txHash,
      wait: vi.fn().mockResolvedValue({
        status: 1, // success
        blockNumber: 123456,
      }),
    };
  }
}; 