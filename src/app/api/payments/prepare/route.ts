import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services/users/user-service';
import { ensureServerInitialized } from '@/lib/server-init';
import { PyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import { ethers } from 'ethers';

// Create a new endpoint to prepare payment transaction data
export async function POST(request: NextRequest) {
  try {
    // Ensure server services are initialized
    await ensureServerInitialized();

    // Parse request body
    const body = await request.json();
    const { recipientUsername, amount, requestId } = body;

    // Validate required fields
    if (!recipientUsername) {
      return NextResponse.json(
        { error: 'Recipient username is required' },
        { status: 400 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { error: 'Payment amount is required' },
        { status: 400 }
      );
    }

    // Get recipient user for wallet access
    const recipient = await userService.getUserByUsername(recipientUsername);
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Format the recipient address to proper checksum format
    const recipientAddress = ethers.getAddress(recipient.walletAddress);

    // Create instance of PyusdTokenService to get token contract details
    const pyusdService = new PyusdTokenService();
    
    // Get the token contract address for the current network
    // For simplicity, we're using Sepolia testnet by default
    const network = 'sepolia';
    const tokenAddress = pyusdService.getTokenAddress(network);
    
    // Parse the amount to token units
    const amountInTokenUnits = pyusdService.parsePyusd(amount, network);

    // Create token transfer transaction data (ERC20 transfer function call)
    // This is the encoded function call for `transfer(address to, uint256 amount)`
    const tokenInterface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    
    const transactionData = tokenInterface.encodeFunctionData('transfer', [
      recipientAddress,
      amountInTokenUnits
    ]);

    // Return the data needed for the frontend to create a transaction
    return NextResponse.json({
      success: true,
      recipientAddress: tokenAddress, // We're sending to the token contract, not directly to recipient
      recipientUsername: recipient.username,
      tokenAddress,
      amount,
      amountInTokenUnits: amountInTokenUnits.toString(),
      transactionData,
      requestId
    });
    
  } catch (error) {
    console.error('Error preparing payment transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare payment transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 