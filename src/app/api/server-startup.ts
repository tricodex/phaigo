import { blockchainTransactionSyncService } from '@/lib/services/blockchain/transaction-sync-service';
import { Network } from '@/types/network';
import { isProduction } from '@/lib/config/environment';

/**
 * Server initialization tasks
 * This runs when the server starts in production mode or when the development server starts
 */
export async function initializeServer(): Promise<void> {
  try {
    console.log('Initializing server...');
    
    // Set up blockchain transaction sync service
    // For development, we use Sepolia testnet
    // For production, we might want to use mainnet
    const network: Network = isProduction ? 'mainnet' : 'sepolia';
    
    await blockchainTransactionSyncService.initialize(network);
    console.log(`Blockchain transaction sync service initialized for ${network}`);
    
    // Add other server initialization tasks here
    
    console.log('Server initialization complete');
  } catch (error) {
    console.error('Error initializing server:', error);
    // Don't throw here, as it would prevent the server from starting
    // Instead, log the error and continue
  }
}

// Clean up function to be called when the server shuts down
export function cleanupServer(): void {
  try {
    console.log('Cleaning up server resources...');
    
    // Clean up blockchain transaction sync service
    blockchainTransactionSyncService.cleanup();
    
    // Add other cleanup tasks here
    
    console.log('Server cleanup complete');
  } catch (error) {
    console.error('Error during server cleanup:', error);
  }
} 