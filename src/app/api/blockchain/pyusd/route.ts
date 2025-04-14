import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { serverEnv } from '@/lib/config/server-env';
import { clientEnv } from '@/lib/config/env';

export const runtime = 'nodejs';

// Standard ERC20 ABI for PYUSD token
const PYUSD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// PYUSD token addresses
const PYUSD_ADDRESS = {
  mainnet: '0x6C3eA9036406852006290770BEdFcAbA0e23A0e8',
  sepolia: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
};

/**
 * Get PYUSD token balance for an address
 */
export async function GET(request: NextRequest) {
  console.log('PYUSD API called with URL:', request.url);
  
  try {
    // Access server environment variables safely
    const serverEnvVars = serverEnv;
    
    // Extract the address and network from the request
    const address = request.nextUrl.searchParams.get('address');
    const network = request.nextUrl.searchParams.get('network') || 'sepolia';
    
    console.log(`PYUSD API processing request for address=${address}, network=${network}`);
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }
    
    // Validate the address
    let checksummedAddress: string;
    try {
      checksummedAddress = ethers.getAddress(address);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }
    
    // Get the appropriate RPC endpoint based on the network
    const endpoints: Record<string, string> = {
      mainnet: serverEnvVars.GCP_HTTP_ENDPOINT_MAINNET,
      sepolia: serverEnvVars.GCP_HTTP_ENDPOINT_SEPOLIA,
    };
    
    // Get the token address for the specified network
    const tokenAddress = PYUSD_ADDRESS[network as keyof typeof PYUSD_ADDRESS];
    if (!tokenAddress) {
      return NextResponse.json(
        { error: `Invalid network: ${network}` },
        { status: 400 }
      );
    }
    
    // Get the base URL for the specified network
    const baseUrl = endpoints[network as keyof typeof endpoints];
    if (!baseUrl) {
      return NextResponse.json(
        { error: `RPC endpoint not configured for network: ${network}` },
        { status: 500 }
      );
    }
    
    // Add API key to the URL - this is done server-side only
    const apiKey = serverEnvVars.GCP_API_KEY;
    if (!apiKey) {
      console.error('GCP_API_KEY not configured in environment variables');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }
    
    // Create RPC URL with API key
    const url = `${baseUrl}?key=${apiKey}`;
    console.log(`Using RPC endpoint: ${baseUrl} (with API key)`);
    
    // Attempt to get balance with retries
    const maxRetries = 3;
    let balance: bigint | null = null;
    let decimals: number | null = null;
    let formattedBalance: string | null = null;
    let errorMessage: string | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Create a provider with timeout and retry options
        const provider = new ethers.JsonRpcProvider(url, undefined, {
          batchMaxCount: 1, // Disable batching for more reliable requests
          polling: false, // Disable long polling
          staticNetwork: true, // Network is static
          cacheTimeout: 2000, // Short cache timeout
        });
        
        // Set timeout for provider
        const timeoutMs = 10000; // 10 seconds
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        
        try {
          console.log(`PYUSD API attempt ${attempt + 1}: Creating contract instance for ${tokenAddress}`);
          
          // Create a contract instance
          const contract = new ethers.Contract(tokenAddress, PYUSD_ABI, provider);
          
          console.log(`PYUSD API attempt ${attempt + 1}: Calling balanceOf for ${checksummedAddress}`);
          
          // Get the balance with timeout
          balance = await Promise.race([
            contract.balanceOf(checksummedAddress),
            new Promise<never>((_, reject) => {
              timeoutController.signal.addEventListener('abort', () => {
                reject(new Error(`RPC request timed out after ${timeoutMs}ms`));
              });
            })
          ]);
          
          console.log(`PYUSD API attempt ${attempt + 1}: Got balance ${balance}`);
          
          // Get the token decimals
          decimals = await contract.decimals();
          
          console.log(`PYUSD API attempt ${attempt + 1}: Got decimals ${decimals}`);
          
          // Format the balance - at this point both balance and decimals can't be null
          formattedBalance = ethers.formatUnits(balance as bigint, decimals as number);
          
          console.log(`PYUSD API success: Balance=${formattedBalance} PYUSD`);
          // Success! Break out of retry loop
          break;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`PYUSD API attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}`);
        
        if (attempt < maxRetries - 1) {
          // Add exponential backoff with jitter
          const delay = Math.pow(2, attempt) * 300 + Math.random() * 300;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we succeeded, return the data
    if (balance !== null && decimals !== null && formattedBalance !== null) {
      return NextResponse.json({
        address: checksummedAddress,
        network,
        balance: balance.toString(),
        formattedBalance,
        decimals: decimals.toString(),
        tokenAddress
      });
    }
    
    // If all attempts failed, try the fallback
    console.error(`All ${maxRetries} attempts to GCP Blockchain RPC failed: ${errorMessage}`);
    return await getFallbackBalanceFromPyusd(request);
  } catch (error) {
    console.error('Error in PYUSD balance query:', error);
    
    // Try to use fallback provider
    try {
      return await getFallbackBalanceFromPyusd(request);
    } catch (fallbackError) {
      console.error('Fallback provider also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to get PYUSD balance', message: (error instanceof Error) ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
}

/**
 * Use fallback provider for PYUSD balance query
 */
async function getFallbackBalanceFromPyusd(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const network = request.nextUrl.searchParams.get('network') || 'sepolia';
  
  if (!address) {
    return NextResponse.json(
      { error: 'Address is required' },
      { status: 400 }
    );
  }
  
  // Validate the address
  let checksummedAddress: string;
  try {
    checksummedAddress = ethers.getAddress(address);
  } catch {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 }
    );
  }
  
  // Get fallback provider
  const fallbacks: Record<string, string> = {
    mainnet: clientEnv.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_MAINNET,
    sepolia: clientEnv.NEXT_PUBLIC_FALLBACK_HTTP_ENDPOINT_SEPOLIA,
  };
  
  const fallbackUrl = fallbacks[network as keyof typeof fallbacks];
  if (!fallbackUrl) {
    return NextResponse.json(
      { error: 'No fallback provider available' },
      { status: 502 }
    );
  }
  
  console.log(`Using fallback provider for PYUSD balance on ${network}:`, fallbackUrl);
  
  // Get the token address for the specified network
  const tokenAddress = PYUSD_ADDRESS[network as keyof typeof PYUSD_ADDRESS];
  
  // Create a provider with timeout and retry options
  const provider = new ethers.JsonRpcProvider(fallbackUrl, undefined, {
    batchMaxCount: 1, // Disable batching
    polling: false, // Disable long polling
    staticNetwork: true,
    cacheTimeout: 2000, // Short cache timeout
  });
  
  // Set timeout for provider
  const timeoutMs = 15000; // 15 seconds (longer for fallback)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  
  try {
    // Create a contract instance
    const contract = new ethers.Contract(tokenAddress, PYUSD_ABI, provider);
    
    // Get the balance with timeout
    const balance = await Promise.race([
      contract.balanceOf(checksummedAddress),
      new Promise<never>((_, reject) => {
        timeoutController.signal.addEventListener('abort', () => {
          reject(new Error(`Fallback RPC request timed out after ${timeoutMs}ms`));
        });
      })
    ]);
    
    // Get the token decimals
    const decimals = await contract.decimals();
    
    // Format the balance
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    // Return the balance
    return NextResponse.json({
      address: checksummedAddress,
      network,
      balance: balance.toString(),
      formattedBalance,
      decimals: decimals.toString(),
      tokenAddress,
      usedFallback: true
    });
  } catch (error) {
    console.error('Error using fallback provider:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
} 