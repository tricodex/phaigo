/**
 * PYUSD Analytics Service
 * 
 * This service provides analytics functionality for the PYUSD stablecoin by leveraging
 * GCP Blockchain RPC's free access to computationally expensive methods.
 */

import { ethers } from 'ethers';
import { gcpBlockchainRpcService } from './gcp-blockchain-rpc';
import { PyusdTokenService, PYUSD_CONFIG } from './pyusd-token';
import { Network } from '@/types/network';
import { singleton } from '@/lib/utils/singleton';

// Transaction data with gas analytics
export interface TransactionData {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  gasCost: string;
  method?: string;
}

// Network congestion data
export interface NetworkCongestionData {
  timestamp: number;
  gasPrice: string;
  baseFee: string;
  priorityFee: string;
  blockNumber: number;
  transactionCount: number;
  pyusdTransactionCount: number;
  pyusdPercentage: number;
}

// Historical data point
export interface HistoricalDataPoint {
  timestamp: number;
  value: string;
  type: 'price' | 'volume' | 'transfers' | 'holders';
}

// Contract activity data
export interface ContractActivityData {
  timestamp: number;
  blockNumber: number;
  methodName: string;
  caller: string;
  gasUsed: string;
  success: boolean;
}

// Type for token transfers
export interface TokenTransfer {
  timestamp: number;
  blockNumber: number;
  txHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
}

// Add missing types
export interface RecentTransaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  method: string;
  successful: boolean;
  blockNumber: number;
  gasUsed: string;
}

export interface RecentTransactionsResponse {
  transactions: RecentTransaction[];
  totalTransactions: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * PYUSD Analytics Service
 */
export class PyusdAnalyticsService {
  private pyusdToken: PyusdTokenService;
  private methodNameCache: Record<string, string> = {};
  
  constructor() {
    this.pyusdToken = new PyusdTokenService();
  }

  /**
   * Get method name from method ID
   * This handles common PYUSD contract methods
   */
  private getMethodName(methodId: string): string {
    if (this.methodNameCache[methodId]) {
      return this.methodNameCache[methodId];
    }
    
    // Common ERC20 method signatures
    const methodMap: Record<string, string> = {
      '0xa9059cbb': 'transfer',
      '0x23b872dd': 'transferFrom',
      '0x095ea7b3': 'approve',
      '0x70a08231': 'balanceOf',
      '0x18160ddd': 'totalSupply',
      '0x313ce567': 'decimals',
      '0x06fdde03': 'name',
      '0x95d89b41': 'symbol',
      '0xdd62ed3e': 'allowance',
      '0x40c10f19': 'mint',
      '0x42966c68': 'burn',
      '0x00000000': 'fallback',
    };
    
    const methodName = methodMap[methodId] || 'unknown';
    this.methodNameCache[methodId] = methodName;
    return methodName;
  }

  /**
   * Normalize an Ethereum address with proper checksum format
   * This is a utility method to ensure addresses are properly checksummed
   */
  private normalizeAddress(address: string): string {
    try {
      // Use ethers.getAddress to properly format the address with checksum
      return ethers.getAddress(address);
    } catch (error) {
      console.error(`Error normalizing address ${address}:`, error);
      // Return the original address if normalization fails
      return address;
    }
  }

  /**
   * Get the PYUSD token address for the specified network with proper checksum
   */
  private getTokenAddress(network: Network): string {
    try {
      // Make sure we have the correct case-sensitive checksummed address
      const rawAddress = PYUSD_CONFIG[network].address.toLowerCase();
      return this.normalizeAddress(rawAddress);
    } catch (error) {
      console.error(`Error normalizing token address for ${network}:`, error);
      // Return the lowercase address as fallback
      return PYUSD_CONFIG[network].address.toLowerCase();
    }
  }

  /**
   * Get the most recent PYUSD transactions
   * This method supports two calling styles:
   * 1. Legacy: getRecentTransactions(network, limit)
   * 2. New: getRecentTransactions(network, options)
   */
  async getRecentTransactions(
    network: Network = 'mainnet', 
    optionsOrLimit?: number | {
      page?: number;
      pageSize?: number;
      filterByMethod?: string;
    }
  ): Promise<RecentTransactionsResponse | TransactionData[]> {
    // Handle legacy mode with number parameter
    if (typeof optionsOrLimit === 'number') {
      const limit = optionsOrLimit;
      try {
        const provider = gcpBlockchainRpcService.getProvider(network);
        const tokenAddress = this.getTokenAddress(network);
        
        // Get current block number
        const currentBlock = await provider.getBlockNumber();
        
        // Define a range of blocks to search (last 1000 blocks or so)
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        try {
          // Get Transfer events from PYUSD contract
          const pyusdContract = new ethers.Contract(
            ethers.getAddress(tokenAddress), // Ensure proper checksum
            [
              'event Transfer(address indexed from, address indexed to, uint256 value)',
              'function balanceOf(address) view returns (uint256)',
              'function totalSupply() view returns (uint256)'
            ],
            provider
          );
          
          // Query for Transfer events
          const filter = pyusdContract.filters.Transfer();
          const events = await pyusdContract.queryFilter(filter, fromBlock, currentBlock);
          
          // Sort events by block number (descending) and take the requested limit
          const recentEvents = events
            .sort((a, b) => (b as ethers.Log).blockNumber - (a as ethers.Log).blockNumber)
            .slice(0, limit);
          
          // Process events into transaction data
          const transactions: TransactionData[] = await Promise.all(
            recentEvents.map(async (event) => {
              const typedEvent = event as unknown as {
                args: { from: string; to: string; value: bigint };
                transactionHash: string;
                blockNumber: number;
              };
              
              // Get transaction details
              const tx = await provider.getTransaction(typedEvent.transactionHash);
              const receipt = await provider.getTransactionReceipt(typedEvent.transactionHash);
              const block = await provider.getBlock(typedEvent.blockNumber);
              
              // Format transaction data
              return {
                hash: typedEvent.transactionHash,
                blockNumber: typedEvent.blockNumber,
                timestamp: block?.timestamp ? Number(block.timestamp) : Date.now() / 1000,
                from: typedEvent.args.from,
                to: typedEvent.args.to,
                value: ethers.formatUnits(typedEvent.args.value, PYUSD_CONFIG[network].decimals),
                gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : '0',
                gasPrice: tx?.gasPrice ? tx.gasPrice.toString() : '0',
                gasCost: receipt?.gasUsed && tx?.gasPrice ? 
                  ethers.formatEther(receipt.gasUsed * tx.gasPrice) : '0',
                method: 'Transfer'
              };
            })
          );
          
          return transactions;
        } catch (contractError) {
          console.error('Error with PYUSD contract interaction:', contractError);
          
          // Return empty array for graceful degradation
          return [];
        }
      } catch (error) {
        console.error('Error getting recent PYUSD transactions:', error);
        return [];
      }
    }
    
    // New implementation with options object
    const options = optionsOrLimit as { page?: number; pageSize?: number; filterByMethod?: string } || {};
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    
    try {
      // Get contract activity first
      const contractActivity = await this.getContractActivity(network);
      
      // Now process the transactions
      const transactions: RecentTransaction[] = await Promise.all(
        contractActivity
          .filter(txn => !options.filterByMethod || txn.methodName === options.filterByMethod)
          .slice((page - 1) * pageSize, page * pageSize)
          .map(async (txn) => {
            try {
              const provider = gcpBlockchainRpcService.getProvider(network);
              const txReceipt = await provider.getTransactionReceipt(txn.blockNumber.toString());
              
              // Normalize all addresses with proper checksums
              const toAddress = txReceipt?.to ? this.normalizeAddress(txReceipt.to) : "";
              const fromAddress = txReceipt?.from ? this.normalizeAddress(txReceipt.from) : "";
              
              return {
                hash: txn.blockNumber.toString(),
                timestamp: txn.timestamp,
                from: fromAddress,
                to: toAddress,
                method: txn.methodName,
                successful: txn.success,
                blockNumber: txn.blockNumber,
                gasUsed: txn.gasUsed,
              };
            } catch (error) {
              console.error(`Error processing transaction:`, error);
              return {
                hash: txn.blockNumber.toString(),
                timestamp: txn.timestamp,
                from: "",
                to: "",
                method: txn.methodName,
                successful: false,
                blockNumber: txn.blockNumber,
                gasUsed: "0",
              };
            }
          })
      );
      
      return {
        transactions,
        totalTransactions: contractActivity.length,
        page,
        pageSize,
        totalPages: Math.ceil(contractActivity.length / pageSize),
      };
    } catch (error) {
      console.error("Error getting recent transactions:", error);
      throw new Error("Failed to fetch recent transactions");
    }
  }

  /**
   * Get network congestion data related to PYUSD
   */
  async getNetworkCongestion(
    network: Network = 'mainnet',
    blocks: number = 10
  ): Promise<NetworkCongestionData[]> {
    try {
      const provider = gcpBlockchainRpcService.getProvider(network);
      const tokenAddress = this.getTokenAddress(network);
      
      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      console.log(`[AnalyticsService] getNetworkCongestion: Current block for ${network}: ${currentBlock}`);
      
      // Collect data for the specified number of recent blocks
      const congestionData: NetworkCongestionData[] = [];
      
      for (let i = 0; i < blocks; i++) {
        const blockNumber = currentBlock - i;
        if (blockNumber < 0) break;
        
        // Get block data
        const block = await provider.getBlock(blockNumber);
        if (!block) continue;
        
        console.log(`[AnalyticsService] Processing block ${blockNumber}...`); // Log block number
        
        // Get all transactions in the block
        const txCount = block.transactions.length;
        console.log(`[AnalyticsService] Block ${blockNumber} has ${txCount} transactions.`); // Log tx count
        
        // Count PYUSD transactions by checking transactions that interact with the token contract
        let pyusdTxCount = 0;
        
        // Ensure proper checksum format for comparison
        const normalizedTokenAddress = ethers.getAddress(tokenAddress).toLowerCase();
        
        for (const txHash of block.transactions.slice(0, Math.min(50, txCount))) {
          try {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            // Check if this transaction interacts with the PYUSD contract
            if (receipt && receipt.to && receipt.to.toLowerCase() === normalizedTokenAddress) {
              pyusdTxCount++;
            } else if (receipt && receipt.logs) {
              // Check if any logs are from the PYUSD contract (for indirect interactions)
              const hasPyusdLogs = receipt.logs.some(
                log => log.address.toLowerCase() === normalizedTokenAddress
              );
              
              if (hasPyusdLogs) {
                pyusdTxCount++;
              }
            }
          } catch (error) {
            console.warn(`Error processing transaction ${txHash}:`, error);
          }
        }
        
        console.log(`[AnalyticsService] Block ${blockNumber}: Found ${pyusdTxCount} PYUSD transactions.`); // Log PYUSD count
        
        // Calculate congestion data
        const baseFeePerGas = block.baseFeePerGas || ethers.parseUnits('0', 'gwei');
        
        // Get fee data for this block
        const feeData = await provider.getFeeData();
        
        congestionData.push({
          timestamp: Number(block.timestamp),
          blockNumber: blockNumber,
          gasPrice: ethers.formatUnits(feeData.gasPrice || ethers.parseUnits('0', 'gwei'), 'gwei'),
          baseFee: ethers.formatUnits(baseFeePerGas, 'gwei'),
          priorityFee: ethers.formatUnits(
            feeData.maxPriorityFeePerGas || ethers.parseUnits('0', 'gwei'), 
            'gwei'
          ),
          transactionCount: txCount,
          pyusdTransactionCount: pyusdTxCount,
          pyusdPercentage: txCount > 0 ? (pyusdTxCount / txCount) * 100 : 0
        });
      }
      
      console.log(`[AnalyticsService] Final congestionData for ${blocks} blocks:`, congestionData); // Log final data
      return congestionData.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('[AnalyticsService] Error getting network congestion data:', error); // Log errors
      return [];
    }
  }

  /**
   * Get contract activity data
   */
  async getContractActivity(
    network: Network
  ): Promise<ContractActivityData[]> {
    try {
      const provider = gcpBlockchainRpcService.getProvider(network);
      const tokenAddress = this.getTokenAddress(network);
      
      // Get the latest block
      const latestBlock = await provider.getBlockNumber();
      
      // Get transactions from a reasonable number of blocks (e.g., last 1000 blocks)
      const blockRange = 1000;
      const fromBlock = Math.max(0, latestBlock - blockRange);
      
      // Create a filter for PYUSD contract events
      const pyusdContract = new ethers.Contract(
        tokenAddress,
        [
          'event Transfer(address indexed from, address indexed to, uint256 value)',
          'event Approval(address indexed owner, address indexed spender, uint256 value)'
        ],
        provider
      );
      
      // Query for events
      const transferFilter = pyusdContract.filters.Transfer();
      const transferEvents = await pyusdContract.queryFilter(transferFilter, fromBlock, latestBlock);
      
      const approvalFilter = pyusdContract.filters.Approval();
      const approvalEvents = await pyusdContract.queryFilter(approvalFilter, fromBlock, latestBlock);
      
      // Combine events
      const events = [...transferEvents, ...approvalEvents];
      
      // Process events into activity data
      const processedTxHashes = new Set<string>();
      const activityData: ContractActivityData[] = [];
      
      for (const event of events) {
        const typedEvent = event as unknown as {
          transactionHash: string;
          blockNumber: number;
          args: { from?: string; to?: string; owner?: string; spender?: string; value: bigint };
        };
        
        // Skip duplicate transactions
        if (processedTxHashes.has(typedEvent.transactionHash)) {
          continue;
        }
        
        processedTxHashes.add(typedEvent.transactionHash);
        
        try {
          // Get transaction and receipt
          const tx = await provider.getTransaction(typedEvent.transactionHash);
          const receipt = await provider.getTransactionReceipt(typedEvent.transactionHash);
          const block = await provider.getBlock(typedEvent.blockNumber);
          
          // Determine method name based on event type or transaction data
          let methodName = 'unknown';
          if (tx && tx.data) {
            const methodId = tx.data.slice(0, 10);
            methodName = this.getMethodName(methodId);
          } else if ('from' in typedEvent.args && 'to' in typedEvent.args) {
            methodName = 'transfer';
          } else if ('owner' in typedEvent.args && 'spender' in typedEvent.args) {
            methodName = 'approve';
          }
          
          // Determine caller (from address or transaction sender)
          const caller = (tx?.from) || (typedEvent.args.from ? this.normalizeAddress(typedEvent.args.from) : 'Unknown');
          
          activityData.push({
            timestamp: block?.timestamp ? Number(block.timestamp) : Date.now() / 1000,
            blockNumber: typedEvent.blockNumber,
            methodName,
            caller,
            gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : '0',
            success: receipt?.status === 1
          });
        } catch (error) {
          console.error(`Error processing event:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      return activityData.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting contract activity:', error);
      return [];
    }
  }

  /**
   * Get historical data for PYUSD (volume, transfers, holders)
   */
  async getHistoricalData(
    network: Network = 'mainnet',
    dataType: 'volume' | 'transfers' | 'holders' = 'volume',
    days: number = 30
  ): Promise<HistoricalDataPoint[]> {
    try {
      const provider = gcpBlockchainRpcService.getProvider(network);
      const tokenAddress = this.getTokenAddress(network);
      
      try {
        // Ensure proper address checksum format
        const checksumAddress = ethers.getAddress(tokenAddress);
        
        const pyusdContract = new ethers.Contract(
          checksumAddress,
          [
            'event Transfer(address indexed from, address indexed to, uint256 value)',
            'function balanceOf(address) view returns (uint256)',
            'function totalSupply() view returns (uint256)'
          ],
          provider
        );
        
        // Get current block number
        const currentBlock = await provider.getBlockNumber();
        
        // Estimate blocks per day (Ethereum averages ~6500 blocks per day)
        const blocksPerDay = 6500;
        
        // Calculate start block based on requested days
        const startBlock = Math.max(0, currentBlock - (blocksPerDay * days));
        
        // Initialize data array with empty data points for each day
        const dataPoints: HistoricalDataPoint[] = [];
        
        switch (dataType) {
          case 'volume': {
            // For volume, we'll track daily transfer volume
            // We need to query in smaller chunks to avoid RPC timeouts
            const chunkSize = 1000;
            const chunks = Math.ceil((currentBlock - startBlock) / chunkSize);
            
            const dailyVolumes: Record<number, bigint> = {};
            
            for (let chunk = 0; chunk < chunks; chunk++) {
              const fromBlockChunk = startBlock + (chunk * chunkSize);
              const toBlockChunk = Math.min(startBlock + ((chunk + 1) * chunkSize) - 1, currentBlock);
              
              try {
                // Query for Transfer events in this chunk
                const filter = pyusdContract.filters.Transfer();
                const events = await pyusdContract.queryFilter(filter, fromBlockChunk, toBlockChunk);
                
                for (const event of events) {
                  const typedEvent = event as unknown as {
                    args: { from: string; to: string; value: bigint };
                    blockNumber: number;
                  };
                  
                  // Get block timestamp
                  const block = await provider.getBlock(typedEvent.blockNumber);
                  if (!block || !block.timestamp) continue;

                  // Calculate day index (0 = today, 1 = yesterday, etc.)
                  const timestamp = Number(block.timestamp);
                  const dayTimestamp = Math.floor(timestamp / 86400) * 86400;

                  // Accumulate volume for this day
                  if (!dailyVolumes[dayTimestamp]) {
                    dailyVolumes[dayTimestamp] = BigInt(0);
                  }
                  
                  dailyVolumes[dayTimestamp] += typedEvent.args.value;
                }
              } catch (error) {
                console.warn(`Error processing chunk ${chunk}:`, error);
              }
            }
            
            // Convert daily volumes to data points
            for (const [timestamp, volume] of Object.entries(dailyVolumes)) {
              dataPoints.push({
                timestamp: Number(timestamp),
                value: ethers.formatUnits(volume, PYUSD_CONFIG[network].decimals),
                type: 'volume'
              });
            }
            
            break;
          }
          
          case 'transfers': {
            // For transfers, we'll count daily transfer count
            // Query in chunks to avoid RPC timeouts
            const chunkSize = 1000;
            const chunks = Math.ceil((currentBlock - startBlock) / chunkSize);
            
            const dailyTransfers: Record<number, number> = {};
            
            for (let chunk = 0; chunk < chunks; chunk++) {
              const fromBlockChunk = startBlock + (chunk * chunkSize);
              const toBlockChunk = Math.min(startBlock + ((chunk + 1) * chunkSize) - 1, currentBlock);
              
              try {
                // Query for Transfer events in this chunk
                const filter = pyusdContract.filters.Transfer();
                const events = await pyusdContract.queryFilter(filter, fromBlockChunk, toBlockChunk);
                
                for (const event of events) {
                  // Get block timestamp
                  const block = await provider.getBlock((event as ethers.Log).blockNumber);
                  if (!block || !block.timestamp) continue;

                  // Calculate day index (0 = today, 1 = yesterday, etc.)
                  const timestamp = Number(block.timestamp);
                  const dayTimestamp = Math.floor(timestamp / 86400) * 86400;

                  // Count transfer for this day
                  if (!dailyTransfers[dayTimestamp]) {
                    dailyTransfers[dayTimestamp] = 0;
                  }
                  
                  dailyTransfers[dayTimestamp]++;
                }
              } catch (error) {
                console.warn(`Error processing chunk ${chunk}:`, error);
              }
            }
            
            // Convert daily transfers to data points
            for (const [timestamp, count] of Object.entries(dailyTransfers)) {
              dataPoints.push({
                timestamp: Number(timestamp),
                value: count.toString(),
                type: 'transfers'
              });
            }
            
            break;
          }
          
          case 'holders': {
            // For holders, we'll estimate unique addresses holding PYUSD
            // by tracking Transfer events
            // Note: This is an estimate based on recent transactions, not a complete holder list
            
            // This is a complex calculation that would require indexing ALL Transfer events
            // For simplicity, we'll provide simulated data here
            // In a production environment, this would be better handled by a proper indexer
            
            const simulatedHolders = [];
            const now = Math.floor(Date.now() / 1000);
            const daySeconds = 86400;
            
            for (let i = 0; i < days; i++) {
              const day = now - (i * daySeconds);
              
              // Simulate a gradually increasing holder count with some noise
              // Replace this with actual calculation in production
              const baseHolders = 1000 + (days - i) * 50;
              const noise = Math.random() * 100 - 50;
              const holderCount = Math.max(0, Math.round(baseHolders + noise));
              
              simulatedHolders.push({
                timestamp: day,
                value: holderCount.toString(),
                type: 'holders' as const
              });
            }
            
            return simulatedHolders;
          }
        }
        
        // Sort data points by timestamp
        return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
      } catch (contractError) {
        console.error('Error with PYUSD contract interaction:', contractError);
        return [];
      }
    } catch (error) {
      console.error('Error getting historical data:', error);
      return [];
    }
  }

  /**
   * Process token transfers from a log
   */
  private async processTransferLog(
    log: { blockNumber: number; transactionHash: string; topics: string[]; data: string },
    network: Network
  ): Promise<TokenTransfer> {
    try {
      const { topics } = log;
      const provider = gcpBlockchainRpcService.getProvider(network);
      
      // Extract addresses from topics
      // Transfer(address indexed from, address indexed to, uint256 value)
      // topics[0] is the event signature
      // topics[1] is the from address (indexed parameter)
      // topics[2] is the to address (indexed parameter)
      // data is the value (non-indexed parameter)
      
      const fromAddress = topics[1] ? ethers.getAddress('0x' + topics[1].substring(26)) : '';
      const toAddress = topics[2] ? ethers.getAddress('0x' + topics[2].substring(26)) : '';
      const value = log.data ? ethers.formatUnits(log.data, PYUSD_CONFIG[network].decimals) : '0';
      
      // Get transaction receipt for gas information
      const receipt = await provider.getTransactionReceipt(log.transactionHash);
      const tx = await provider.getTransaction(log.transactionHash);
      
      // Get block timestamp
      const block = await provider.getBlock(log.blockNumber);
            
      return {
        timestamp: block?.timestamp ? Number(block.timestamp) : Date.now() / 1000,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        from: fromAddress || "",
        to: toAddress || "",
        value,
        gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : '0',
        gasPrice: tx?.gasPrice ? tx.gasPrice.toString() : '0'
      };
    } catch (error) {
      console.error('Error processing transfer log:', error);
      throw error;
    }
  }

  /**
   * Get trace transaction data using debug_traceTransaction
   * This leverages GCP's free access to computationally expensive methods
   */
  async getTransactionTrace(
    txHash: string,
    network: Network = 'mainnet'
  ) {
    try {
      return await gcpBlockchainRpcService.getTransactionTrace(txHash, network);
    } catch (error) {
      console.error('Error getting transaction trace:', error);
      return null;
    }
  }

  /**
   * Get top token holders (limited by API calls)
   */
  async getTopHolders(
    network: Network = 'mainnet', 
    limit: number = 10
  ): Promise<{ address: string; balance: string }[]> {
    try {
      // This is a simulated function since getting all token holders requires 
      // indexing all Transfer events from the beginning of the contract
      // In a production environment, this would be done using an indexer or API
      
      // Return simulated data now, but use network to adjust values for testnet vs mainnet
      const baseAmount = network === 'mainnet' ? 10000000 : 100000;
      
      return Array.from({ length: limit }, (_, i) => ({
        address: `0x${i.toString(16).padStart(40, '0')}`,
        balance: (baseAmount / (i + 1)).toFixed(2)
      }));
    } catch (error) {
      console.error('Error getting top PYUSD holders:', error);
      return [];
    }
  }

  /**
   * Get token market data
   */
  async getTokenMarketData(network: Network = 'mainnet'): Promise<{
    totalSupply: string;
    marketCap: string;
    price: string;
    holders: number;
    transactions24h: number;
  }> {
    try {
      const provider = gcpBlockchainRpcService.getProvider(network);
      const tokenAddress = this.getTokenAddress(network);
      
      try {
        // Create contract instance with proper address checksum
        const pyusdContract = new ethers.Contract(
          ethers.getAddress(tokenAddress),
          [
            'function totalSupply() view returns (uint256)',
          ],
          provider
        );
        
        // Get total supply
        const totalSupply = await pyusdContract.totalSupply();
        const formattedSupply = ethers.formatUnits(totalSupply, PYUSD_CONFIG[network].decimals);
        
        // PYUSD is a stablecoin pegged to USD, so price should be 1
        const price = '1.00';
        const marketCap = formattedSupply;
        
        // These values are estimated/simulated since they require indexing
        const holders = 15000 + Math.floor(Math.random() * 1000);
        const transactions24h = 2500 + Math.floor(Math.random() * 500);
        
        return {
          totalSupply: formattedSupply,
          marketCap,
          price,
          holders,
          transactions24h
        };
      } catch (contractError) {
        console.error('Error with PYUSD contract interaction:', contractError);
        
        // Return fallback values on contract error
        return {
          totalSupply: '0',
          marketCap: '0',
          price: '1.00',
          holders: 0,
          transactions24h: 0
        };
      }
    } catch (error) {
      console.error('Error getting PYUSD market data:', error);
      return {
        totalSupply: '0',
        marketCap: '0',
        price: '1.00',
        holders: 0,
        transactions24h: 0
      };
    }
  }
}

// Export singleton instance of the service for consistent state throughout the application
export const analyticsService = singleton(PyusdAnalyticsService);
