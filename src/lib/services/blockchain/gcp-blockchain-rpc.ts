/**
 * GCP Blockchain RPC Service
 * Provides enhanced blockchain interaction capabilities using Google Cloud's Blockchain RPC service
 */

import { ethers } from 'ethers';
import { PyusdTokenService } from './pyusd-token';
import { Network, getRpcUrl, getWsUrl, getProxyRpcUrl, getWsProxyUrl, getNetworkChainId } from '@/types/network';
export type { Network } from '@/types/network';
import { singleton } from '@/lib/utils/singleton';
import { createRpcUrl } from '@/lib/utils/url-helpers';

export interface PYUSDEvent {
  from: string;
  to: string;
  value: bigint;
}

export type TxRetraceData = {
  transactionHash: string;
  blockNumber: number;
  stateChanges: Record<string, unknown>[];
  gasInfo: {
    gasUsed: string;
    gasPrice: string;
    gasExpectedUsage: string;
  };
  status: 'SUCCESS' | 'REVERT' | 'INTERNAL_ERROR';
  error?: string;
};

// Configuration for HTTP and WebSocket endpoints
interface RpcConfig {
  http: {
    mainnet: string;
    sepolia: string;
  };
  ws: {
    mainnet: string;
    sepolia: string;
  };
}

/**
 * GCP Blockchain RPC Service provides enhanced blockchain interaction
 * capabilities using Google Cloud's Blockchain RPC service.
 */
export class GcpBlockchainRpcService {
  private readonly config: RpcConfig;
  private readonly providers: Record<Network, ethers.JsonRpcProvider> = {} as Record<
    Network,
    ethers.JsonRpcProvider
  >;
  private readonly wsProviders: Record<Network, ethers.WebSocketProvider> = {} as Record<
    Network,
    ethers.WebSocketProvider
  >;
  private readonly subscriptions: Record<string, ethers.Listener> = {};
  private webSocketProvider?: WebSocket = undefined;
  private timeout: number = 30000; // Default timeout of 30 seconds
  private nextId: number = 1;

  constructor() {
    // Initialize configuration from environment variables
    this.config = {
      http: {
        mainnet: getRpcUrl('mainnet'),
        sepolia: getRpcUrl('sepolia'),
      },
      ws: {
        mainnet: getWsUrl('mainnet'),
        sepolia: getWsUrl('sepolia'),
      },
    };

    // Initialize providers for all networks
    this.initializeProviders();
  }

  /**
   * Initialize HTTP and WebSocket providers for all networks
   */
  private initializeProviders(): void {
    const networks: Network[] = ['mainnet', 'sepolia'];

    for (const network of networks) {
      // Initialize HTTP provider with secure API route
      try {
        // Use our secure API proxy for RPC calls with absolute URL
        const secureRpcUrl = getProxyRpcUrl(network);
        
        // Create the JSON RPC provider with the secure URL and enhanced options
        const networkObj = ethers.Network.from(getNetworkChainId(network));
        const httpProvider = new ethers.JsonRpcProvider(secureRpcUrl, networkObj, {
          // Disable batching to prevent ID mismatches
          batchMaxCount: 1,
          // Increase polling interval to reduce load 
          pollingInterval: 15000,
          // Increase timeout for slow responses
          cacheTimeout: 30000,
          // Prevent network detection to avoid "chain not supported" errors
          staticNetwork: networkObj
        });
        
        // Log RPC requests for debugging, but don't modify the _send method
        // to avoid type compatibility issues
        console.debug(`Initialized HTTP provider for ${network} with URL: ${secureRpcUrl}`);
        
        this.providers[network] = httpProvider;
      } catch (error) {
        console.error(`Failed to initialize HTTP provider for ${network}:`, error);
      }

      // Initialize WebSocket provider with secure connection
      try {
        // Get secure WebSocket URL via API proxy with absolute URL
        const initWebSocketProvider = async () => {
          try {
            // First fetch the authenticated WebSocket URL
            const wsProxyUrl = getWsProxyUrl(network);
            const response = await fetch(wsProxyUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to get WebSocket URL: ${response.statusText}`);
            }
            
            const data = await response.json();
            const secureWsUrl = data.wsUrl;
            
            // Create WebSocket provider with authenticated URL and network information
            const networkObj = ethers.Network.from(getNetworkChainId(network));
            const wsProvider = new ethers.WebSocketProvider(
              secureWsUrl,
              networkObj, 
              { staticNetwork: networkObj }
            );
            
            this.wsProviders[network] = wsProvider;
            
            console.debug(`Initialized WebSocket provider for ${network}`);
          } catch (wsError) {
            console.error(`Failed to initialize WebSocket provider for ${network}:`, wsError);
          }
        };
        
        // Initialize WebSocket asynchronously
        initWebSocketProvider();
      } catch (error) {
        console.error(`Error setting up WebSocket provider for ${network}:`, error);
      }
    }
  }

  /**
   * Get a provider for a specific network
   */
  public getProvider(network: Network): ethers.JsonRpcProvider {
    return this.providers[network];
  }

  /**
   * Get a WebSocket provider for a specific network
   */
  public getWsProvider(network: Network): ethers.WebSocketProvider | undefined {
    return this.wsProviders[network];
  }

  /**
   * Create a custom filter using polling with eth_getLogs instead of eth_newFilter
   * This is more compatible with GCP Blockchain RPC which doesn't support eth_newFilter
   */
  public async createCustomFilter(
    address: string,
    topics: Array<string | Array<string> | null>,
    callback: (log: ethers.Log) => void,
    network: Network = 'sepolia'
  ): Promise<() => void> {
    // Use the HTTP provider which supports eth_getLogs
    const provider = this.providers[network];
    if (!provider) {
      console.warn(`No provider available for ${network}`);
      return () => {};
    }
    
    try {
      // Create a unique key for this polling operation
      const filterKey = `poll:${address}:${JSON.stringify(topics)}:${network}`;
      
      // Set up state for tracking the latest block we've processed
      let lastBlockProcessed = await provider.getBlockNumber();
      console.log(`Starting log polling from block ${lastBlockProcessed} for address ${address}`);
      
      // Create the filter function that will poll for logs
      const pollForLogs = async () => {
        try {
          // Get current block number
          const currentBlock = await provider.getBlockNumber();
          
          // If no new blocks, skip this poll
          if (currentBlock <= lastBlockProcessed) return;
          
          // Prepare filter for eth_getLogs - use a limited block range to avoid timeouts
          // Don't query more than 100 blocks at once to prevent large responses
          const fromBlock = lastBlockProcessed + 1;
          const toBlock = Math.min(currentBlock, fromBlock + 99);
          
          // Create filter parameters for eth_getLogs
          const filter = {
            address: address,
            topics: topics,
            fromBlock: ethers.toBeHex(fromBlock),
            toBlock: ethers.toBeHex(toBlock)
          };
          
          // Query for logs in the specified block range
          const logs = await provider.send("eth_getLogs", [filter]);
          
          // Process each log through the callback
          if (logs && logs.length > 0) {
            console.log(`Found ${logs.length} logs for address ${address} in blocks ${fromBlock}-${toBlock}`);
            for (const log of logs) {
              // Convert hex numbers to regular numbers for compatibility
              const normalizedLog = {
                ...log,
                blockNumber: typeof log.blockNumber === 'string' 
                  ? parseInt(log.blockNumber.replace('0x', ''), 16) 
                  : log.blockNumber,
                transactionIndex: typeof log.transactionIndex === 'string'
                  ? parseInt(log.transactionIndex.replace('0x', ''), 16)
                  : log.transactionIndex,
                logIndex: typeof log.logIndex === 'string'
                  ? parseInt(log.logIndex.replace('0x', ''), 16)
                  : log.logIndex
              };
              
              // Pass the normalized log to the callback
              callback(normalizedLog as unknown as ethers.Log);
            }
          }
          
          // Update the last processed block number
          lastBlockProcessed = toBlock;
        } catch (error) {
          console.error('Error polling for logs:', error);
        }
      };
      
      // Run the initial poll
      pollForLogs();
      
      // Set up polling interval - every 15 seconds is a reasonable compromise
      const pollInterval = setInterval(pollForLogs, 15000);
      
      // Store the cleanup function
      this.subscriptions[filterKey] = () => {
        clearInterval(pollInterval);
        console.log(`Stopped log polling for address ${address}`);
      };
      
      // Return a function to clear the interval when no longer needed
      return () => this.cleanupSubscription(filterKey);
    } catch (error) {
      console.error('Error creating custom filter with polling:', error);
      return () => {};
    }
  }

  /**
   * Get a transaction trace from the GCP Blockchain RPC service
   * This is a secure method fetching transaction trace via protected API endpoint
   */
  public async getTransactionTrace(
    txHash: string,
    network: Network
  ): Promise<TxRetraceData | null> {
    try {
      // Use proper absolute URL for the API endpoint
      const url = createRpcUrl('/api/blockchain/transaction/trace', { 
        network, 
        txHash 
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data as TxRetraceData;
    } catch (error) {
      console.error('Error retrieving transaction trace:', error);
      return null;
    }
  }

  /**
   * Monitor PYUSD balance for a specific address
   * Sets up listeners for balance changes via WebSocket events
   */
  public monitorPyusdBalance(
    address: string,
    network: Network,
    callback: (balance: bigint, event?: ethers.Log) => void
  ): () => void {
    const subscriptionKey = `balance:${address}:${network}`;
    
    // Clean up any existing subscription
    if (this.subscriptions[subscriptionKey]) {
      this.cleanupSubscription(subscriptionKey);
    }
    
    // Get the token service
    const tokenService = new PyusdTokenService();
    
    // Setup event filter and listener
    const setupListener = async () => {
      try {
        // Set up initial balance
        const initialBalance = await tokenService.getBalance(address, network);
        callback(initialBalance);
        
        // Set up WebSocket monitoring
        const cleanup = tokenService.monitorBalance(
          address,
          callback,
          network
        );
        
        // Store cleanup function
        this.subscriptions[subscriptionKey] = cleanup;
        
        return cleanup;
      } catch (error) {
        console.error('Error setting up PYUSD balance monitoring:', error);
        return () => {};
      }
    };
    
    // Initialize the monitoring
    setupListener();
    
    // Return cleanup function
    return () => this.cleanupSubscription(subscriptionKey);
  }

  /**
   * Clean up a specific subscription
   */
  private cleanupSubscription(key: string): void {
    if (this.subscriptions[key]) {
      try {
        // Execute the stored cleanup function
        if (typeof this.subscriptions[key] === 'function') {
          this.subscriptions[key]();
        }
      } catch (error) {
        console.error(`Error cleaning up subscription ${key}:`, error);
      }
      
      // Remove from subscriptions
      delete this.subscriptions[key];
    }
  }

  /**
   * Clean up all subscriptions and WebSocket connections
   */
  public cleanup(): void {
    // Clean up all subscriptions
    for (const key in this.subscriptions) {
      this.cleanupSubscription(key);
    }
    
    // Close all WebSocket connections
    for (const network in this.wsProviders) {
      try {
        this.wsProviders[network as Network].destroy();
      } catch (error) {
        console.error(`Error closing WebSocket connection for ${network}:`, error);
      }
    }
  }

  async call(method: string, params: unknown[]): Promise<unknown> {
    try {
      // Use the mainnet provider as default
      return await this.providers.mainnet.send(method, params);
    } catch (error) {
      console.error(`Error making RPC call to ${method}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const gcpBlockchainRpcService = singleton(GcpBlockchainRpcService); 