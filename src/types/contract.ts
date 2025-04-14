import { Network } from './network';

/**
 * Contract interface representing an Ethereum smart contract
 */
export interface Contract {
  id: string;
  name: string;
  address: string;
  network: Network;
  type: ContractType;
  tokenSymbol?: string;
  tokenDecimals?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contract types supported in the application
 */
export type ContractType = 'ERC20' | 'ERC721' | 'ERC1155' | 'Custom';

/**
 * Contract token balance information
 */
export interface ContractBalance {
  contractId: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  lastUpdated: Date;
}

/**
 * Raw contract data as received from API
 */
export interface ContractRawResponse {
  id: string;
  name?: string;
  address: string;
  network?: Network;
  type?: ContractType;
  tokenSymbol?: string;
  tokenDecimals?: number;
  createdAt?: string | number;
  updatedAt?: string | number;
}

/**
 * Convert a contract response from API to a typed Contract
 */
export const normalizeContractResponse = (data: ContractRawResponse): Contract => {
  return {
    id: data.id,
    name: data.name || 'Unknown Contract',
    address: data.address,
    network: data.network || 'sepolia',
    type: data.type || 'Custom',
    tokenSymbol: data.tokenSymbol,
    tokenDecimals: data.tokenDecimals,
    createdAt: new Date(data.createdAt || Date.now()),
    updatedAt: new Date(data.updatedAt || Date.now())
  };
}; 