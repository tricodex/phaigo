/**
 * Test script for GCP Blockchain RPC Service
 * 
 * This script demonstrates the proper way to use the GCP Blockchain RPC service
 * using our service layer abstraction.
 * 
 * Run with:
 * bun run src/scripts/test-gcp-rpc.ts
 */

import { gcpBlockchainRpcService } from '../lib/services/blockchain/gcp-blockchain-rpc';
import { pyusdTokenService } from '../lib/services/blockchain/pyusd-token';

async function testGcpRpc() {
  try {
    console.log('Testing GCP Blockchain RPC Service...');
    
    // Test 1: Get block number (simple method)
    const provider = gcpBlockchainRpcService.getProvider('sepolia');
    const blockNumber = await provider.getBlockNumber();
    console.log('Current block number:', blockNumber);
    
    // Test 2: Get chain ID
    const network = await provider.getNetwork();
    console.log('Network:', {
      chainId: network.chainId,
      name: network.name
    });
    
    // Test 3: Get PYUSD balance (eth_call)
    const testAddress = '0xb067fb16afcabf8a8974a35cbcee243b8fdf0ea1'; // Replace with your test address
    const balance = await pyusdTokenService.getBalance(testAddress, 'sepolia');
    console.log('PYUSD Balance:', pyusdTokenService.formatPyusd(balance));
    
    // Test 4: Get transaction history (using pagination for eth_getLogs)
    console.log('Fetching transaction history...');
    const events = await pyusdTokenService.getTransactionHistory(testAddress, 'sepolia', 20);
    console.log(`Found ${events.length} PYUSD transactions`);
    
    // Display the first 3 events
    events.slice(0, 3).forEach((event, index) => {
      const direction = event.from.toLowerCase() === testAddress.toLowerCase() ? 'OUT' : 'IN';
      const value = event.amount || BigInt(0);
      console.log(`Event ${index + 1}: ${direction} | Amount: ${pyusdTokenService.formatPyusd(value)} PYUSD`);
    });
    
    console.log('All tests completed successfully');
  } catch (error) {
    console.error('Error running GCP RPC tests:', error);
  } finally {
    // Clean up any WebSocket connections
    gcpBlockchainRpcService.cleanup();
  }
}

// Run the tests
testGcpRpc(); 