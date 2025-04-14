/**
 * PYUSD Token Service
 * 
 * This service provides functionality for interacting with the PayPal USD (PYUSD) stablecoin
 * on the Ethereum blockchain. It includes methods for retrieving balances, transferring tokens,
 * and more.
 */

import { ethers } from 'ethers';
import { gcpBlockchainRpcService } from './gcp-blockchain-rpc';
import { Network } from '@/types/network';
import { clientEnv } from '@/lib/config/env';
import { Contract } from '@/types/contract';

interface PYUSDEvent {
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

interface PyusdConfig {
  mainnet: {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
  sepolia: {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
}

export const PYUSD_CONFIG: PyusdConfig = {
  mainnet: {
    // Real PYUSD token address on Ethereum mainnet with correct checksum
    address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    decimals: 6,
    symbol: 'PYUSD',
    name: 'PayPal USD',
  },
  sepolia: {
    // Test PYUSD token address on Sepolia testnet
    address: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
    decimals: 6,
    symbol: 'tPYUSD',
    name: 'Test PayPal USD',
  },
};

// Standard ERC20 ABI
const ERC20_ABI = [
  // Read-only functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // Write functions
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  
  // EIP-2612 Permit extension
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

/**
 * PYUSD Token Service
 */
export class PyusdTokenService {
  private tokenConfig: PyusdConfig;

  constructor() {
    this.tokenConfig = {
      mainnet: {
        address: clientEnv.NEXT_PUBLIC_PYUSD_CONTRACT_ADDRESS,
        decimals: 6,
        symbol: 'PYUSD',
        name: 'PayPal USD'
      },
      sepolia: {
        address: clientEnv.NEXT_PUBLIC_PYUSD_TESTNET_CONTRACT_ADDRESS,
        decimals: 6,
        symbol: 'PYUSD',
        name: 'Test PayPal USD'
      }
    };
  }

  /**
   * Validate an Ethereum address
   * @param address The address to validate
   * @throws Error if the address is invalid
   */
  validateAddress(address: string): string {
    if (!address) {
      throw new Error('Missing Ethereum address: Address cannot be undefined or empty');
    }
    
    try {
      // Use ethers.getAddress instead of isAddress to normalize and validate
      // This ensures checksum validation and returns the checksummed address
      return ethers.getAddress(address);
    } catch {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
  }

  /**
   * Get the token address for the specified network
   */
  getTokenAddress(network: Network = 'sepolia'): string {
    return this.tokenConfig[network].address;
  }

  /**
   * Get the token contract instance for the specified network
   */
  getTokenContract(network: Network = 'sepolia', signerOrProvider?: ethers.Provider | ethers.Signer): ethers.Contract {
    if (signerOrProvider) {
      return new ethers.Contract(this.getTokenAddress(network), ERC20_ABI, signerOrProvider);
    }
    
    // Use the preconfigured provider from GCP service which has the network already set
    const provider = gcpBlockchainRpcService.getProvider(network);
    return new ethers.Contract(this.getTokenAddress(network), ERC20_ABI, provider);
  }

  /**
   * Format an amount of PYUSD for display (considering the 6 decimal places)
   */
  formatPyusd(amount: bigint | string, network: Network = 'sepolia'): string {
    return ethers.formatUnits(amount, this.tokenConfig[network].decimals);
  }

  /**
   * Parse a user input amount to PYUSD units (considering the 6 decimal places)
   */
  parsePyusd(amount: string, network: Network = 'sepolia'): bigint {
    return ethers.parseUnits(amount, this.tokenConfig[network].decimals);
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string, network: Network = 'sepolia'): Promise<bigint> {
    // Normalize the address to proper checksum format
    const checksummedAddress = this.validateAddress(address);
    
    try {
      // Call the server-side API endpoint ONLY
      const response = await fetch(`/api/blockchain?address=${checksummedAddress}&network=${network}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // Ensure fresh data
        }
      });
      
      if (!response.ok) {
        let errorBody = { error: `Server-side PYUSD API failed with status ${response.status}` };
        try {
          errorBody = await response.json();
        } catch { /* Ignore if body isn't JSON */ }
        console.error('Server-side PYUSD API error:', errorBody);
        throw new Error(errorBody.error || `Failed to fetch balance from API (Status: ${response.status})`);
      }
      
      const data = await response.json();
      if (typeof data.balance === 'undefined') {
        console.error('API response missing balance field:', data);
        throw new Error('Invalid balance data received from API');
      }
      
      return BigInt(data.balance);
      
    } catch (error) {
      console.error('Error getting PYUSD balance via API:', error);
      // Re-throw the error to be handled by the calling component
      throw error instanceof Error ? error : new Error('Failed to get balance');
    }
  }

  /**
   * Get formatted balance for an address (calls getBalance)
   */
  async getFormattedBalance(
    address: string, 
    network: Network = 'sepolia'
  ): Promise<string> {
    try {
      const balance = await this.getBalance(address, network);
      return this.formatPyusd(balance, network);
    } catch (error) {
      console.error('Error getting formatted balance:', error);
      return 'Error'; // Return an error string or handle appropriately
    }
  }

  /**
   * Transfer tokens to an address
   */
  async transfer(
    to: string, 
    amount: string, 
    signer: ethers.Signer,
    network: Network = 'sepolia'
  ): Promise<ethers.TransactionResponse> {
    try {
      const checksummedTo = this.validateAddress(to);
      const amountInTokenUnits = this.parsePyusd(amount, network);
      
      const contract = this.getTokenContract(network, signer);
      return await contract.transfer(checksummedTo, amountInTokenUnits);
    } catch (error) {
      console.error('Error transferring PYUSD:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for an address by processing logs in small chunks
   * according to GCP Blockchain RPC best practices
   */
  async getTransactionHistory(
    address: string, 
    network: Network = 'sepolia',
    maxBlocks = 50
  ): Promise<PYUSDEvent[]> {
    try {
      const checksummedAddress = this.validateAddress(address);
      const contract = this.getTokenContract(network);
      const provider = gcpBlockchainRpcService.getProvider(network);
      
      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      
      // Initialize array for all events
      const allEvents: PYUSDEvent[] = [];
      
      // Process in chunks of 5 blocks as per GCP Blockchain RPC limitations
      const CHUNK_SIZE = 5;
      const iterations = Math.ceil(maxBlocks / CHUNK_SIZE);
      
      // Process each chunk
      for (let i = 0; i < iterations; i++) {
        const toBlock = currentBlock - (i * CHUNK_SIZE);
        // Ensure we don't go below block 0
        const fromBlock = Math.max(0, toBlock - CHUNK_SIZE + 1);
        
        // Skip if we've reached the end
        if (toBlock < 0) break;
        
        // Convert block numbers to hexadecimal as required by GCP Blockchain RPC
        const fromBlockHex = `0x${fromBlock.toString(16)}`;
        const toBlockHex = `0x${toBlock.toString(16)}`;
        
        console.log(`Querying logs from block ${fromBlockHex} to ${toBlockHex}`);
        
        try {
          // Query for incoming transfers
          const incomingFilter = contract.filters.Transfer(null, checksummedAddress);
          const incomingEvents = await contract.queryFilter(
            incomingFilter,
            fromBlockHex,
            toBlockHex
          );
          
          // Query for outgoing transfers
          const outgoingFilter = contract.filters.Transfer(checksummedAddress, null);
          const outgoingEvents = await contract.queryFilter(
            outgoingFilter,
            fromBlockHex,
            toBlockHex
          );
          
          // Process events and convert to our PYUSDEvent format
          const processedEvents = [...incomingEvents, ...outgoingEvents].map(event => {
            // Safely access event data with type checking
            const eventData = event as unknown as { 
              args: { from: string; to: string; value: bigint }; 
              transactionHash: string; 
              blockNumber: number 
            };
            
            return {
              from: eventData.args?.from || '',
              to: eventData.args?.to || '',
              amount: eventData.args?.value || BigInt(0),
              txHash: eventData.transactionHash,
              blockNumber: eventData.blockNumber,
              timestamp: 0 // Will be populated later if needed
            };
          });
          
          // Add to all events
          allEvents.push(...processedEvents);
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(`Error querying blocks ${fromBlockHex}-${toBlockHex}:`, error);
          // Continue to next chunk instead of failing entirely
        }
      }
      
      // Sort all events by block number (descending)
      return allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
    } catch (error) {
      console.error('Error getting PYUSD transaction history:', error);
      throw error;
    }
  }

  /**
   * Get allowance for a spender
   */
  async getAllowance(
    owner: string,
    spender: string,
    network: Network = 'sepolia'
  ): Promise<bigint> {
    try {
      const contract = this.getTokenContract(network);
      return await contract.allowance(owner, spender);
    } catch (error) {
      console.error('Error getting PYUSD allowance:', error);
      throw error;
    }
  }

  /**
   * Approve a spender to spend tokens
   */
  async approve(
    spender: string,
    amount: string | bigint,
    signer: ethers.Signer,
    network: Network = 'sepolia'
  ): Promise<ethers.TransactionResponse> {
    try {
      const amountInTokenUnits = typeof amount === 'string' 
        ? this.parsePyusd(amount, network)
        : amount;
      
      const contract = this.getTokenContract(network, signer);
      return await contract.approve(spender, amountInTokenUnits);
    } catch (error) {
      console.error('Error approving PYUSD:', error);
      throw error;
    }
  }

  /**
   * Get the permit signature data for gasless approvals (EIP-2612)
   */
  async getPermitSignature(
    signer: ethers.Signer,
    spender: string,
    value: string | bigint,
    deadline: number,
    network: Network = 'sepolia'
  ): Promise<{ v: number, r: string, s: string }> {
    try {
      const valueInTokenUnits = typeof value === 'string' 
        ? this.parsePyusd(value, network)
        : value;
      
      const contract = this.getTokenContract(network, signer);
      const signerAddress = await signer.getAddress();
      
      // Get the current nonce for the signer
      const nonce = await contract.nonces(signerAddress);
      
      // Create the permit signature
      const domain = {
        name: await contract.name(),
        version: '1',
        chainId: (await gcpBlockchainRpcService.getProvider(network).getNetwork()).chainId,
        verifyingContract: this.getTokenAddress(network)
      };
      
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };
      
      const message = {
        owner: signerAddress,
        spender,
        value: valueInTokenUnits,
        nonce,
        deadline
      };
      
      // Sign the permit using EIP-712
      const signature = await signer.signTypedData(domain, types, message);
      
      // Split the signature
      const signatureSplit = ethers.Signature.from(signature);
      
      return {
        v: signatureSplit.v,
        r: signatureSplit.r,
        s: signatureSplit.s
      };
    } catch (error) {
      console.error('Error getting PYUSD permit signature:', error);
      throw error;
    }
  }

  /**
   * Execute a permit operation for gasless approvals
   */
  async executePermit(
    owner: string,
    spender: string,
    value: string | bigint,
    deadline: number,
    v: number,
    r: string,
    s: string,
    signer: ethers.Signer,
    network: Network = 'sepolia'
  ): Promise<ethers.TransactionResponse> {
    try {
      const valueInTokenUnits = typeof value === 'string' 
        ? this.parsePyusd(value, network)
        : value;
      
      const contract = this.getTokenContract(network, signer);
      return await contract.permit(
        owner,
        spender,
        valueInTokenUnits,
        deadline,
        v,
        r,
        s
      );
    } catch (error) {
      console.error('Error executing PYUSD permit:', error);
      throw error;
    }
  }

  /**
   * Monitor balance changes for an address
   */
  monitorBalance(
    address: string,
    callback: (balance: bigint, event?: ethers.EventLog) => void,
    network: Network = 'sepolia'
  ): (() => void) {
    try {
      const checksummedAddress = this.validateAddress(address);
      
      // Function to update balance
      const updateBalance = async () => {
        try {
          const balance = await this.getBalance(checksummedAddress, network);
          callback(balance);
        } catch (error) {
          console.error('Error updating PYUSD balance:', error);
        }
      };
      
      // Get initial balance right away
      updateBalance();
      
      // Set up polling for balance updates - most reliable approach with GCP RPC
      console.info('Setting up PYUSD balance polling for address:', checksummedAddress);
      const pollInterval = setInterval(() => updateBalance(), 15000); // Poll every 15 seconds
      
      // Return cleanup function
      return () => {
        clearInterval(pollInterval);
        console.info('Cleaned up PYUSD balance polling for address:', checksummedAddress);
      };
    } catch (error) {
      console.error('Error setting up PYUSD balance monitoring:', error);
      return () => {}; // Return empty cleanup function
    }
  }

  /**
   * Get the token symbol
   * @param network Optional network to specify which token configuration to use
   * @returns The token symbol (e.g., "PYUSD")
   */
  public getTokenSymbol(network: Network = 'sepolia'): string {
    return this.tokenConfig[network].symbol;
  }

  /**
   * Get contracts for a specific wallet address
   * This method returns the PYUSD token contract for the specified network
   * 
   * @param walletAddress The wallet address to get contracts for
   * @param network The network to get contracts for
   * @returns Array of Contract objects
   */
  async getContracts(walletAddress: string, network: Network = 'sepolia'): Promise<Contract[]> {
    try {
      // For now, we only return the PYUSD token contract
      return [
        {
          id: `pyusd-${network}`,
          name: this.tokenConfig[network].name,
          address: this.getTokenAddress(network),
          network,
          type: 'ERC20',
          tokenSymbol: this.tokenConfig[network].symbol,
          tokenDecimals: this.tokenConfig[network].decimals,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    } catch (error) {
      console.error('Error getting contracts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const pyusdTokenService = new PyusdTokenService(); 