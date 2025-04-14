import { prisma } from '@/lib/db/prisma';
import { PyusdTokenService } from './pyusd-token';
import { gcpBlockchainRpcService } from './gcp-blockchain-rpc';
import { Network } from '@/types/network';
import { ethers } from 'ethers';
import { paymentService } from '../payments/payment-service';
import { singleton } from '@/lib/utils/singleton';
import type { Prisma } from '@prisma/client';

// Interface for transfer events
interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
  transactionHash: string;
  blockNumber: number;
  timestamp?: number;
}

/**
 * Blockchain Transaction Sync Service
 * Monitors blockchain events and syncs them with the database
 * The blockchain is the source of truth; the database is a cache
 */
export class BlockchainTransactionSyncService {
  private pyusdTokenService: PyusdTokenService;
  private transferListeners: Record<string, () => void> = {};
  private syncInterval: NodeJS.Timeout | null = null;
  public isInitialized = false;
  private lastProcessedBlock: Record<string, number> = {};

  constructor() {
    this.pyusdTokenService = new PyusdTokenService();
  }

  /**
   * Initialize blockchain monitoring for PYUSD transfers
   */
  public async initialize(network: Network = 'sepolia'): Promise<void> {
    if (this.isInitialized) {
      console.log('Blockchain sync service already initialized');
      return;
    }

    try {
      console.log(`Initializing blockchain sync service for ${network}`);
      
      // First, clean up any stale transactions from previous runs
      console.log('Checking for stale transactions on startup...');
      await this.detectAndFixStaleTransactions(network, 2).catch(error => {
        console.error('Error cleaning up stale transactions on startup:', error);
      });
      
      // Start periodic full sync (catch any missed events)
      this.startPeriodicSync(network);
      
      this.isInitialized = true;
      console.log(`Blockchain sync service initialized for ${network}`);
    } catch (error) {
      console.error('Failed to initialize blockchain sync service:', error);
      throw error;
    }
  }

  /**
   * Process a single transfer event
   * Updates corresponding payment record in database if it exists
   */
  private async processTransferEvent(event: TransferEvent): Promise<void> {
    try {
      // Check if this transaction already has a DB record
      const existingPayment = await prisma.payment.findUnique({
        where: { transactionHash: event.transactionHash }
      });

      if (existingPayment) {
        // If payment exists but is not completed, update it
        if (existingPayment.status !== 'COMPLETED') {
          await this.updatePaymentFromEvent(existingPayment.id, event);
        }
      } else {
        // This might be a new transfer that wasn't created through our app
        // Optionally create a new payment record if you want to track external transfers
        // await this.createExternalPayment(event, network);
        console.log(`External transfer detected: ${event.transactionHash}`);
      }
    } catch (error) {
      console.error(`Error processing transfer event ${event.transactionHash}:`, error);
    }
  }

  /**
   * Update a payment record from a blockchain event
   */
  private async updatePaymentFromEvent(paymentId: string, event: TransferEvent): Promise<void> {
    try {
      // Update the payment with blockchain data
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          blockNumber: event.blockNumber,
          blockTimestamp: event.timestamp ? new Date(event.timestamp * 1000) : undefined,
          syncedAt: new Date(),
          syncRetries: { increment: 1 },
          syncError: null // Clear any previous errors
        } as Prisma.PaymentUpdateInput
      });

      // Call payment service to confirm the payment
      const result = await paymentService.confirmPayment(paymentId, event.transactionHash);
      
      if (result.success) {
        console.log(`Payment ${paymentId} confirmed with tx hash ${event.transactionHash}`);
      } else {
        console.error(`Failed to confirm payment ${paymentId}:`, result.error);
        
        // Record the error
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            syncError: result.error
          } as Prisma.PaymentUpdateInput
        });
      }
    } catch (error) {
      console.error(`Error updating payment ${paymentId} from event:`, error);
      
      // Record the error
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          syncRetries: { increment: 1 },
          syncError: error instanceof Error ? error.message : 'Unknown error updating payment'
        } as Prisma.PaymentUpdateInput
      });
    }
  }

  /**
   * Perform a full sync of recent transactions
   * This catches any events that might have been missed
   */
  private async performFullSync(network: Network): Promise<void> {
    try {
      console.log(`Performing full sync for ${network}`);
      
      // Get all pending payments
      const pendingPayments = await prisma.payment.findMany({
        where: { status: 'PENDING' },
        include: {
          sender: true,
          recipient: true
        }
      }) || [];
      
      if (pendingPayments.length === 0) {
        console.log('No pending payments to sync');
        return;
      }
      
      console.log(`Found ${pendingPayments.length} pending payments to check`);
      
      // For each pending payment, check if it has been confirmed on-chain
      for (const payment of pendingPayments) {
        // Skip payments that don't have a transaction hash yet
        if (!payment.transactionHash) continue;
        
        try {
          // Get transaction receipt
          const provider = gcpBlockchainRpcService.getProvider(network);
          const receipt = await provider.getTransactionReceipt(payment.transactionHash);
          
          // Update sync attempt counter
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              syncRetries: { increment: 1 },
              syncedAt: new Date()
            } as Prisma.PaymentUpdateInput
          });
          
          // If transaction is confirmed
          if (receipt && receipt.blockNumber && receipt.status === 1) {
            // Get block for timestamp
            const block = await provider.getBlock(receipt.blockNumber);
            const timestamp = block ? new Date(block.timestamp * 1000) : undefined;
            
            // Update payment with blockchain data
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                blockNumber: receipt.blockNumber,
                blockTimestamp: timestamp,
                syncError: null // Clear any previous errors
              } as Prisma.PaymentUpdateInput
            });
            
            // Confirm the payment
            await paymentService.confirmPayment(payment.id, payment.transactionHash);
            console.log(`Confirmed pending payment ${payment.id} with tx ${payment.transactionHash}`);
          } else if (receipt && receipt.status === 0) {
            // Transaction failed on-chain
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                blockNumber: receipt.blockNumber,
                syncError: 'Transaction failed on blockchain'
              } as Prisma.PaymentUpdateInput
            });
            
            await paymentService.failPayment(payment.id);
            console.log(`Marked payment ${payment.id} as failed due to failed transaction`);
          }
          // If receipt is null, transaction is still pending
        } catch (error) {
          console.error(`Error checking transaction status for payment ${payment.id}:`, error);
          
          // Record the error
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              syncError: error instanceof Error ? error.message : 'Unknown error checking transaction'
            } as Prisma.PaymentUpdateInput
          });
        }
      }
    } catch (error) {
      console.error('Error performing full sync:', error);
    }
  }

  /**
   * Poll for new transfer events using eth_getLogs instead of ethers event filtering
   * This avoids using eth_newFilter which isn't supported by GCP Blockchain RPC
   */
  private async pollForTransferEvents(network: Network = 'sepolia'): Promise<void> {
    try {
      const provider = gcpBlockchainRpcService.getProvider(network);
      if (!provider) {
        console.warn(`No provider available for ${network}`);
        return;
      }

      // Get the current block number
      const currentBlock = await provider.getBlockNumber();
      
      // If this is the first run, initialize lastProcessedBlock for this network
      if (!this.lastProcessedBlock[network]) {
        // Start from current block on first run
        this.lastProcessedBlock[network] = currentBlock - 10; // Look back 10 blocks initially
        console.log(`Initializing transfer event polling at block ${this.lastProcessedBlock[network]}`);
      }
      
      // Don't process if there are no new blocks
      if (currentBlock <= this.lastProcessedBlock[network]) {
        return;
      }
      
      // Get the token contract address
      const tokenAddress = this.pyusdTokenService.getTokenAddress(network);
      
      // Prepare for eth_getLogs - use limited block ranges to avoid timeouts
      // Don't query more than 50 blocks at once
      const fromBlock = this.lastProcessedBlock[network] + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 49);
      
      // Convert block numbers to hexadecimal
      const fromBlockHex = ethers.toBeHex(fromBlock);
      const toBlockHex = ethers.toBeHex(toBlock);
      
      console.log(`Polling for PYUSD transfers from block ${fromBlock} to ${toBlock}`);
      
      // Define the Transfer event topic (keccak256 hash of Transfer(address,address,uint256))
      const transferEventTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      // Create filter parameters for eth_getLogs
      const filter = {
        address: tokenAddress,
        topics: [transferEventTopic],
        fromBlock: fromBlockHex,
        toBlock: toBlockHex
      };
      
      // Query for logs
      const logs = await provider.send("eth_getLogs", [filter]);
      
      if (logs && logs.length > 0) {
        console.log(`Found ${logs.length} PYUSD transfer events in blocks ${fromBlock}-${toBlock}`);
        
        // Process each log
        for (const log of logs) {
          try {
            // Normalize log data
            const normalizedLog = {
              ...log,
              blockNumber: typeof log.blockNumber === 'string' 
                ? parseInt(log.blockNumber.replace('0x', ''), 16) 
                : log.blockNumber,
              topics: log.topics || []
            };
            
            // Decode the Transfer event data
            // Transfer(address indexed from, address indexed to, uint256 value)
            // topics[0] = event signature
            // topics[1] = from address (indexed)
            // topics[2] = to address (indexed)
            // data = value (non-indexed parameter)
            if (normalizedLog.topics.length >= 3) {
              const from = ethers.getAddress('0x' + normalizedLog.topics[1].slice(26));
              const to = ethers.getAddress('0x' + normalizedLog.topics[2].slice(26));
              const value = normalizedLog.data 
                ? BigInt(normalizedLog.data) 
                : BigInt(0);
              
              // Create TransferEvent object
              const transferEvent: TransferEvent = {
                from,
                to,
                value,
                transactionHash: normalizedLog.transactionHash,
                blockNumber: normalizedLog.blockNumber
              };
              
              // Try to get block timestamp
              try {
                const block = await provider.getBlock(normalizedLog.blockNumber);
                if (block) {
                  transferEvent.timestamp = Number(block.timestamp);
                }
              } catch (blockError) {
                console.warn(`Could not get timestamp for block ${normalizedLog.blockNumber}:`, blockError);
              }
              
              // Process the transfer event
              await this.processTransferEvent(transferEvent);
            }
          } catch (logError) {
            console.error('Error processing transfer log:', logError, log);
          }
        }
      }
      
      // Update the last processed block
      this.lastProcessedBlock[network] = toBlock;
    } catch (error) {
      console.error('Error polling for transfer events:', error);
    }
  }

  /**
   * Start the periodic sync service
   * This will sync payments with the blockchain every 30 seconds
   */
  startPeriodicSync(networkOrInterval?: Network | number, intervalSeconds = 30): void {
    // Handle both old and new method signatures for backward compatibility
    let network: Network = 'sepolia';
    let interval = intervalSeconds;
    
    // If first parameter is a string, it's the network
    if (typeof networkOrInterval === 'string') {
      network = networkOrInterval;
    } 
    // If it's a number, it's the interval
    else if (typeof networkOrInterval === 'number') {
      interval = networkOrInterval;
    }
    
    console.log(`Starting blockchain transaction sync service for ${network} with ${interval}s interval`);
    
    // Clear any existing interval first
    this.stopPeriodicSync();
    
    // Set up a new interval for periodic syncing
    this.syncInterval = setInterval(() => {
      // First check pending payments
      this.syncPendingPayments(network)
        .catch((error: Error) => console.error('Error in periodic payment sync:', error));
      
      // Then check for new transactions using eth_getLogs
      this.pollForTransferEvents(network)
        .catch((error: Error) => console.error('Error polling for transfer events:', error));
    }, interval * 1000);
    
    console.log(`Blockchain sync service will run every ${interval} seconds`);
  }
  
  /**
   * Stop the periodic sync service
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Clean up any event listeners
    for (const key in this.transferListeners) {
      try {
        this.transferListeners[key]();
      } catch (error) {
        console.error(`Error cleaning up listener ${key}:`, error);
      }
    }
    this.transferListeners = {};
  }
  
  /**
   * Sync pending payments with the blockchain
   */
  private async syncPendingPayments(network: Network = 'sepolia'): Promise<void> {
    try {
      await this.performFullSync(network);
    } catch (error) {
      console.error('Error syncing pending payments:', error);
    }
  }

  /**
   * Detects and fixes stale pending transactions
   * Identifies transactions that have been pending for too long and resolves them
   * @param network The blockchain network to use for verification
   * @param hoursOld Number of hours after which a pending transaction is considered stale
   * @returns Number of stale transactions processed
   */
  public async detectAndFixStaleTransactions(network: Network = 'sepolia', hoursOld = 2): Promise<number> {
    try {
      console.log(`Checking for stale pending transactions older than ${hoursOld} hours`);
      
      // Calculate cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursOld);
      
      // Find payments that have been pending for too long
      const stalePayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: cutoffTime },
        },
        include: {
          sender: true,
          recipient: true,
          request: true
        }
      }) || [];
      
      if (stalePayments.length === 0) {
        console.log('No stale pending transactions found');
        return 0;
      }
      
      console.log(`Found ${stalePayments.length} stale pending transactions to resolve`);
      
      let resolvedCount = 0;
      
      // Get provider for transaction verification
      const provider = gcpBlockchainRpcService.getProvider(network);
      
      // Process each stale payment
      for (const payment of stalePayments) {
        try {
          // Safely access sender and recipient usernames with null checks
          const senderUsername = payment.sender?.username || 'unknown sender';
          const recipientUsername = payment.recipient?.username || 'unknown recipient';
          
          console.log(`Processing stale payment ${payment.id} from ${senderUsername} to ${recipientUsername}`);
          
          // If there's no transaction hash, we can just fail it
          if (!payment.transactionHash) {
            console.log(`Payment ${payment.id} has no transaction hash, marking as failed`);
            await paymentService.failPayment(payment.id);
            resolvedCount++;
            continue;
          }
          
          // Check if the transaction exists on the blockchain
          try {
            const receipt = await provider.getTransactionReceipt(payment.transactionHash);
            
            if (receipt && receipt.status === 1) {
              // Transaction succeeded but wasn't captured by sync service
              console.log(`Stale payment ${payment.id} was actually successful, confirming it now`);
              
              // Get block timestamp
              const block = await provider.getBlock(receipt.blockNumber);
              const timestamp = block ? new Date(block.timestamp * 1000) : undefined;
              
              // Update payment with blockchain data
              await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  blockNumber: receipt.blockNumber,
                  blockTimestamp: timestamp,
                  syncedAt: new Date(),
                  syncRetries: { increment: 1 },
                  syncError: null
                } as Prisma.PaymentUpdateInput
              });
              
              // Confirm the payment
              await paymentService.confirmPayment(payment.id, payment.transactionHash);
              resolvedCount++;
            } else if (receipt && receipt.status === 0) {
              // Transaction failed on the blockchain
              console.log(`Stale payment ${payment.id} failed on blockchain, updating status`);
              
              await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  blockNumber: receipt.blockNumber,
                  syncedAt: new Date(),
                  syncRetries: { increment: 1 },
                  syncError: 'Transaction failed on blockchain'
                } as Prisma.PaymentUpdateInput
              });
              
              await paymentService.failPayment(payment.id);
              resolvedCount++;
            } else {
              // No receipt or still pending after X hours
              // Check if transaction exists in mempool or was never sent
              const tx = await provider.getTransaction(payment.transactionHash);
              
              if (!tx) {
                // Transaction doesn't exist on-chain at all - likely never submitted or invalid hash
                console.log(`Transaction ${payment.transactionHash} for payment ${payment.id} doesn't exist on-chain, marking as failed`);
                
                await prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    syncedAt: new Date(),
                    syncRetries: { increment: 1 },
                    syncError: 'Transaction not found on blockchain - possibly never submitted'
                  } as Prisma.PaymentUpdateInput
                });
                
                await paymentService.failPayment(payment.id);
                resolvedCount++;
              } else {
                // Transaction exists but no receipt after X hours - still pending in mempool
                console.log(`Transaction ${payment.transactionHash} for payment ${payment.id} is still pending after ${hoursOld} hours`);
                
                // Check if we should consider it stale based on gas price or other factors
                // For now, just mark it as failed if it's been pending too long
                console.log(`Marking long-pending transaction as failed after ${hoursOld} hours`);
                
                await prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    syncedAt: new Date(),
                    syncRetries: { increment: 1 },
                    syncError: `Transaction pending for more than ${hoursOld} hours - likely stuck`
                  } as Prisma.PaymentUpdateInput
                });
                
                await paymentService.failPayment(payment.id);
                resolvedCount++;
              }
            }
          } catch (txError) {
            // Error while checking transaction - likely doesn't exist or can't be retrieved
            console.error(`Error checking transaction ${payment.transactionHash} for payment ${payment.id}:`, txError);
            
            // Record the error and mark as failed
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                syncedAt: new Date(),
                syncRetries: { increment: 1 },
                syncError: txError instanceof Error ? txError.message : 'Error checking transaction status'
              } as Prisma.PaymentUpdateInput
            });
            
            await paymentService.failPayment(payment.id);
            resolvedCount++;
          }
        } catch (paymentError) {
          console.error(`Error processing stale payment ${payment.id}:`, paymentError);
          
          // Record the error but continue processing other payments
          try {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                syncedAt: new Date(),
                syncRetries: { increment: 1 },
                syncError: paymentError instanceof Error ? paymentError.message : 'Error resolving stale payment'
              } as Prisma.PaymentUpdateInput
            });
          } catch (updateError) {
            console.error(`Failed to update error info for payment ${payment.id}:`, updateError);
          }
        }
      }
      
      console.log(`Successfully resolved ${resolvedCount} of ${stalePayments.length} stale transactions`);
      return resolvedCount;
    } catch (error) {
      console.error('Error detecting and fixing stale transactions:', error);
      return 0;
    }
  }

  /**
   * Check a specific transaction by hash
   * This can be used to force an immediate status update for a payment
   */
  public async checkTransactionByHash(txHash: string, network: Network = 'sepolia'): Promise<boolean> {
    try {
      console.log(`[TxCheck] Checking transaction ${txHash} on ${network}`);
      
      // Find the payment with this transaction hash
      const payment = await prisma.payment.findUnique({
        where: { transactionHash: txHash },
        include: { // Include relations for better logging
          sender: true,
          recipient: true
        }
      });
      
      if (!payment) {
        console.log(`[TxCheck] No payment found for transaction hash ${txHash}`);
        return false;
      }
      
      console.log(`[TxCheck] Found payment: ID=${payment.id}, Status=${payment.status}, Amount=${payment.amount}, From=${payment.sender.username}, To=${payment.recipient.username}`);
      
      // Skip if the payment is already completed
      if (payment.status === 'COMPLETED') {
        console.log(`[TxCheck] Payment ${payment.id} already completed`);
        return true;
      }
      
      // Get transaction receipt with retry logic
      const provider = gcpBlockchainRpcService.getProvider(network);
      let receipt;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!receipt && attempts < maxAttempts) {
        try {
          attempts++;
          receipt = await provider.getTransactionReceipt(txHash);
          
          if (!receipt && attempts < maxAttempts) {
            console.log(`[TxCheck] No receipt yet for ${txHash}, retrying (${attempts}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
          }
        } catch (error) {
          console.error(`[TxCheck] Error getting receipt on attempt ${attempts}:`, error);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw error; // Rethrow if we've exhausted our attempts
          }
        }
      }
      
      // If transaction is confirmed
      if (receipt && receipt.blockNumber && receipt.status === 1) {
        console.log(`[TxCheck] Transaction ${txHash} is confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);
        
        // Get block for timestamp with retry
        let block;
        attempts = 0;
        
        while (!block && attempts < maxAttempts) {
          try {
            attempts++;
            block = await provider.getBlock(receipt.blockNumber);
            
            if (!block && attempts < maxAttempts) {
              console.log(`[TxCheck] No block info yet, retrying (${attempts}/${maxAttempts})...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(`[TxCheck] Error getting block on attempt ${attempts}:`, error);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              // Continue without block info if we can't get it
              console.warn(`[TxCheck] Could not get block info after ${maxAttempts} attempts`);
            }
          }
        }
        
        const timestamp = block ? new Date(block.timestamp * 1000) : undefined;
        
        // Update payment with blockchain data
        console.log(`[TxCheck] Updating payment ${payment.id} with blockchain data`);
        try {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              blockNumber: receipt.blockNumber,
              blockTimestamp: timestamp,
              syncedAt: new Date(),
              syncRetries: { increment: 1 },
              syncError: null // Clear any previous errors
            }
          });
        } catch (dbError) {
          console.error(`[TxCheck] Database error updating payment ${payment.id}:`, dbError);
          // Continue with confirmation attempt despite DB error
        }
        
        // Confirm the payment
        console.log(`[TxCheck] Confirming payment ${payment.id}`);
        const result = await paymentService.confirmPayment(payment.id, txHash);
        
        if (result.success) {
          console.log(`[TxCheck] Payment ${payment.id} confirmed successfully!`);
          return true;
        } else {
          console.error(`[TxCheck] Failed to confirm payment ${payment.id}:`, result.error);
          return false;
        }
      } else if (receipt && receipt.status === 0) {
        // Transaction failed on-chain
        console.log(`[TxCheck] Transaction ${txHash} failed on-chain with status 0`);
        
        const failResult = await paymentService.failPayment(payment.id);
        console.log(`[TxCheck] Payment ${payment.id} marked as failed: ${failResult.success}`);
        return false;
      } else {
        // Transaction not yet confirmed (might still be pending)
        console.log(`[TxCheck] Transaction ${txHash} not yet confirmed. Receipt status: ${receipt ? receipt.status : 'null'}`);
        return false;
      }
    } catch (error) {
      console.error(`[TxCheck] Critical error checking transaction ${txHash}:`, error);
      return false;
    }
  }

  /**
   * Stop all blockchain monitoring and sync tasks
   */
  public cleanup(): void {
    // Clean up all transfer listeners
    Object.values(this.transferListeners).forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Error cleaning up transfer listener:', error);
      }
    });
    
    // Clear the transfer listeners
    this.transferListeners = {};
    
    // Clean up sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.isInitialized = false;
    console.log('Blockchain sync service cleaned up');
  }
}

// Export singleton instance
export const blockchainTransactionSyncService = singleton(BlockchainTransactionSyncService); 