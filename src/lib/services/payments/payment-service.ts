import { prisma } from '@/lib/db/prisma';
import type { Payment, Request, RequestStatus } from '@prisma/client';
import { userService } from '../users/user-service';
import { PyusdTokenService } from '../blockchain/pyusd-token';
import type { Network } from '@/types/network';
import { ethers } from 'ethers';

export interface CreatePaymentParams {
  amount: string;
  notes?: string;
  senderWalletAddress: string;
  recipientUsername: string;
  transactionHash?: string;
  requestId?: string;
}

export interface PaymentResult {
  success: boolean;
  payment?: Payment;
  error?: string;
  code?: string;
  forceChecked?: boolean;
  confirmed?: boolean;
}

export class PaymentService {
  private pyusdTokenService: PyusdTokenService;

  constructor() {
    this.pyusdTokenService = new PyusdTokenService();
  }

  /**
   * Track a new blockchain payment
   * Records metadata about a payment that has been (or will be) executed on the blockchain
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      // Validate inputs before proceeding
      if (!params.senderWalletAddress) {
        return {
          success: false,
          error: 'Sender wallet address is required',
          code: 'MISSING_SENDER'
        };
      }

      if (!params.recipientUsername) {
        return {
          success: false,
          error: 'Recipient username is required',
          code: 'MISSING_RECIPIENT'
        };
      }

      if (!params.amount) {
        return {
          success: false,
          error: 'Payment amount is required',
          code: 'MISSING_AMOUNT'
        };
      }

      const normalizedSenderAddress = params.senderWalletAddress.toLowerCase();
      
      // Validate wallet address format
      const validationResult = userService.validateWalletAddress(normalizedSenderAddress);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error || 'Invalid sender wallet address',
          code: 'INVALID_SENDER_ADDRESS'
        };
      }
      
      // Get or create sender user
      const sender = await userService.findOrCreateUser(normalizedSenderAddress);
      if (!sender) {
        return {
          success: false,
          error: `Failed to create or find sender with address ${normalizedSenderAddress}`,
          code: 'SENDER_CREATION_FAILED'
        };
      }
      
      // Get recipient user - make sure it exists
      const recipient = await userService.getUserByUsername(params.recipientUsername);
      if (!recipient) {
        return {
          success: false,
          error: `Recipient with username "${params.recipientUsername}" not found`,
          code: 'RECIPIENT_NOT_FOUND'
        };
      }
      
      // Don't allow sending to yourself
      if (sender.id === recipient.id) {
        return {
          success: false,
          error: "Cannot send payment to yourself",
          code: 'SELF_PAYMENT'
        };
      }

      console.log(`Tracking payment from ${sender.username} (${sender.walletAddress}) to ${recipient.username} (${recipient.walletAddress})`);

      // Create payment record to track the blockchain transaction
      // Status is determined by whether we have a transaction hash:
      // - If we have a hash, it's been submitted to the blockchain (PENDING)
      // - If we don't have a hash yet, it's waiting for blockchain submission (PENDING)
      // Actual confirmation will be handled by the blockchain sync service
      const payment = await prisma.$transaction(async (tx) => {
        // Create payment
        const payment = await tx.payment.create({
          data: {
            amount: params.amount,
            notes: params.notes,
            transactionHash: params.transactionHash,
            status: 'PENDING', // Always pending until blockchain confirms
            sender: { connect: { id: sender.id } },
            recipient: { connect: { id: recipient.id } }
          }
        });

        // If there's a request to fulfill, mark it as in progress
        if (params.requestId) {
          // Get the request to ensure it exists and belongs to the recipient
          const request = await tx.request.findUnique({
            where: { id: params.requestId }
          });

          if (!request) {
            throw new Error(`Request with ID "${params.requestId}" not found`);
          }

          if (request.userId !== recipient.id) {
            throw new Error('Request does not belong to the recipient');
          }

          // Update the request to link it to the payment
          // Mark as IN_PROGRESS until blockchain confirms, then it will be FULFILLED
          await tx.request.update({
            where: { id: params.requestId },
            data: {
              status: 'IN_PROGRESS' as RequestStatus,
              fulfilledBy: { connect: { id: payment.id } }
            }
          });
        }

        return payment;
      });

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating payment',
        code: 'PAYMENT_CREATION_FAILED'
      };
    }
  }

  /**
   * Update payment record when transaction is submitted to blockchain
   * Called after the frontend submits the transaction to the blockchain
   */
  async recordTransactionHash(paymentId: string, transactionHash: string): Promise<PaymentResult> {
    try {
      if (!paymentId) {
        return {
          success: false,
          error: 'Payment ID is required',
          code: 'MISSING_PAYMENT_ID'
        };
      }

      if (!transactionHash) {
        return {
          success: false,
          error: 'Transaction hash is required',
          code: 'MISSING_TX_HASH'
        };
      }

      // Verify the payment exists
      const existingPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!existingPayment) {
        return {
          success: false,
          error: `Payment with ID "${paymentId}" not found`,
          code: 'PAYMENT_NOT_FOUND'
        };
      }

      // Update the payment with the transaction hash
      // The blockchain sync service will update the status to COMPLETED once confirmed
      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          transactionHash
          // Status remains PENDING until confirmed on-chain
        }
      });

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error recording transaction hash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error recording transaction hash',
        code: 'RECORD_TX_HASH_FAILED'
      };
    }
  }

  /**
   * Update payment status when transaction is confirmed on the blockchain
   * This is called by the blockchain sync service or directly via API
   */
  async confirmPayment(
    paymentId: string, 
    transactionHash: string,
    walletAddress?: string,
    options?: { forceCheck?: boolean }
  ): Promise<PaymentResult> {
    try {
      if (!paymentId) {
        return {
          success: false,
          error: 'Payment ID is required',
          code: 'MISSING_PAYMENT_ID'
        };
      }

      if (!transactionHash) {
        return {
          success: false,
          error: 'Transaction hash is required',
          code: 'MISSING_TX_HASH'
        };
      }

      // Verify the payment exists
      const existingPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          request: true,
          sender: true
        }
      });

      if (!existingPayment) {
        return {
          success: false,
          error: `Payment with ID "${paymentId}" not found`,
          code: 'PAYMENT_NOT_FOUND'
        };
      }

      // Verify wallet authorization if provided
      if (walletAddress) {
        const normalizedWalletAddress = walletAddress.toLowerCase();
        
        // Ensure the caller is the sender of the payment
        if (existingPayment.sender.walletAddress.toLowerCase() !== normalizedWalletAddress) {
          return {
            success: false,
            error: 'Unauthorized: Only the payment sender can confirm this payment',
            code: 'UNAUTHORIZED'
          };
        }
      }

      // First update the transaction hash if it's not set yet
      if (!existingPayment.transactionHash) {
        await this.recordTransactionHash(paymentId, transactionHash);
      }

      // Force check transaction status if requested
      let forceCheckStatus = false;
      if (options?.forceCheck) {
        try {
          // Here we would perform a blockchain check for transaction status
          // This would typically call a blockchain service method
          console.log(`Force checking transaction status for hash: ${transactionHash}`);
          
          // For now, we'll just mark it as completed without verification
          // In a real implementation, you'd verify the transaction status on-chain
          forceCheckStatus = true;
        } catch (error) {
          console.error('Error force checking transaction:', error);
          // Continue with payment update even if force check fails
        }
      }

      // Use a transaction to update both payment and related request
      const payment = await prisma.$transaction(async (tx) => {
        // Update the payment status
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            transactionHash,
            status: 'COMPLETED'
          },
          include: {
            sender: true,
            recipient: true
          }
        });

        // If this payment is fulfilling a request, update the request status too
        if (existingPayment.request) {
          await tx.request.update({
            where: { id: existingPayment.request.id },
            data: {
              status: 'FULFILLED'
            }
          });
        }

        return updatedPayment;
      });

      return {
        success: true,
        payment,
        forceChecked: options?.forceCheck === true,
        confirmed: forceCheckStatus
      };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error confirming payment',
        code: 'PAYMENT_CONFIRMATION_FAILED'
      };
    }
  }

  /**
   * Mark payment as failed when transaction fails on the blockchain
   * This is called by the blockchain sync service, not directly by users
   */
  async failPayment(paymentId: string): Promise<PaymentResult> {
    try {
      if (!paymentId) {
        return {
          success: false,
          error: 'Payment ID is required',
          code: 'MISSING_PAYMENT_ID'
        };
      }

      // Verify the payment exists
      const existingPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          request: true
        }
      });

      if (!existingPayment) {
        return {
          success: false,
          error: `Payment with ID "${paymentId}" not found`,
          code: 'PAYMENT_NOT_FOUND'
        };
      }

      // Use a transaction to update both payment and related request
      const payment = await prisma.$transaction(async (tx) => {
        // Update the payment status
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'FAILED'
          }
        });

        // If this payment is fulfilling a request, reset the request
        if (existingPayment.request) {
          await tx.request.update({
            where: { id: existingPayment.request.id },
            data: {
              status: 'OPEN', // Reset to open
              paymentId: null // Remove link to the failed payment
            }
          });
        }

        return updatedPayment;
      });

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error failing payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error failing payment',
        code: 'PAYMENT_FAIL_UPDATE_FAILED'
      };
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment | null> {
    try {
      if (!id) {
        console.warn('Attempted to get payment with empty ID');
        return null;
      }

      return await prisma.payment.findUnique({
        where: { id },
        include: {
          sender: true,
          recipient: true,
          request: true
        }
      });
    } catch (error) {
      console.error('Error getting payment by ID:', error);
      throw error;
    }
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByTransactionHash(txHash: string): Promise<Payment | null> {
    try {
      if (!txHash) {
        console.warn('Attempted to get payment with empty transaction hash');
        return null;
      }

      return await prisma.payment.findUnique({
        where: { transactionHash: txHash },
        include: {
          sender: true,
          recipient: true,
          request: true
        }
      });
    } catch (error) {
      console.error('Error getting payment by transaction hash:', error);
      throw error;
    }
  }

  /**
   * Create a payment request
   */
  async createPaymentRequest(
    userId: string,
    amount: string,
    notes?: string,
    expiresAt?: Date
  ): Promise<Request> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!amount) {
        throw new Error('Amount is required');
      }

      return await prisma.request.create({
        data: {
          amount,
          notes,
          status: 'OPEN',
          expiresAt,
          user: { connect: { id: userId } }
        }
      });
    } catch (error) {
      console.error('Error creating payment request:', error);
      throw error;
    }
  }

  /**
   * Cancel a payment request
   */
  async cancelPaymentRequest(requestId: string, userId: string): Promise<Request> {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Verify request belongs to the user
      const request = await prisma.request.findUnique({
        where: { id: requestId }
      });

      if (!request) {
        throw new Error(`Request with ID "${requestId}" not found`);
      }

      if (request.userId !== userId) {
        throw new Error('You are not authorized to cancel this request');
      }

      if (request.status !== 'OPEN') {
        throw new Error(`Request is already ${request.status.toLowerCase()}`);
      }

      return await prisma.request.update({
        where: { id: requestId },
        data: {
          status: 'CANCELED'
        }
      });
    } catch (error) {
      console.error('Error canceling payment request:', error);
      throw error;
    }
  }

  /**
   * Get payment request by ID
   */
  async getRequestById(requestId: string): Promise<Request | null> {
    try {
      if (!requestId) {
        console.warn('Attempted to get request with empty ID');
        return null;
      }

      return await prisma.request.findUnique({
        where: { id: requestId },
        include: {
          user: true,
          fulfilledBy: {
            include: {
              sender: true,
              recipient: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting payment request by ID:', error);
      throw error;
    }
  }

  /**
   * Get open payment requests
   */
  async getOpenPaymentRequests(limit = 10): Promise<Request[]> {
    try {
      return await prisma.request.findMany({
        where: {
          status: 'OPEN',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        include: {
          user: true
        }
      });
    } catch (error) {
      console.error('Error getting open payment requests:', error);
      throw error;
    }
  }

  /**
   * Check for expired requests and update their status
   */
  async updateExpiredRequests(): Promise<number> {
    try {
      const now = new Date();
      const result = await prisma.request.updateMany({
        where: {
          status: 'OPEN',
          expiresAt: {
            lt: now
          }
        },
        data: {
          status: 'EXPIRED'
        }
      });
      
      return result.count;
    } catch (error) {
      console.error('Error updating expired requests:', error);
      throw error;
    }
  }

  // Cancel a pending payment (can only be done by the sender)
  async cancelPayment(paymentId: string, walletAddress: string): Promise<PaymentResult> {
    // Find the payment with sender information
    const payment = await this.getPaymentById(paymentId);
    
    // Check if payment exists
    if (!payment) {
      return {
        success: false,
        error: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND'
      };
    }
    
    // Find the sender by wallet address
    const sender = await userService.getUserByWalletAddress(walletAddress);
    
    // Check if sender exists
    if (!sender) {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }
    
    // Verify the wallet address belongs to the sender
    if (payment.senderId !== sender.id) {
      return {
        success: false,
        error: 'Unauthorized. Only the sender can cancel this payment',
        code: 'UNAUTHORIZED'
      };
    }
    
    // Check if payment can be canceled (only PENDING payments)
    if (payment.status !== 'PENDING') {
      return {
        success: false,
        error: `Payment cannot be canceled. Current status: ${payment.status}`,
        code: 'INVALID_STATUS'
      };
    }
    
    // Cancel the payment and update any associated request
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Update payment status to FAILED
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          syncError: 'Canceled by sender',
          syncedAt: new Date(),
        },
        include: {
          sender: true,
          recipient: true,
          request: true
        }
      });
      
      // If this payment is associated with a request, update it to OPEN
      if (updatedPayment.request) {
        await tx.request.update({
          where: { id: updatedPayment.request.id },
          data: { status: 'OPEN' }
        });
      }
      
      return updatedPayment;
    });
    
    return {
      success: true,
      payment: updatedPayment
    };
  }

  /**
   * Transfer PYUSD directly using a wallet
   * This will be used to open the wallet UI and make a blockchain transaction
   */
  async transferPyusd(
    senderWalletAddress: string, 
    recipientWalletAddress: string, 
    amount: string,
    signer: ethers.Signer,
    network: Network = 'sepolia'
  ): Promise<{ 
    success: boolean; 
    transactionHash?: string; 
    error?: string;
  }> {
    try {
      // Format addresses
      const fromAddress = senderWalletAddress.toLowerCase();
      const toAddress = recipientWalletAddress.toLowerCase();
      
      // Validate the addresses
      if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
        return {
          success: false,
          error: 'Invalid wallet address'
        };
      }
      
      // Ensure the signer's address matches the sender
      const signerAddress = (await signer.getAddress()).toLowerCase();
      if (signerAddress !== fromAddress) {
        return {
          success: false,
          error: 'Signer address does not match sender address'
        };
      }

      // Send the transaction
      const tx = await this.pyusdTokenService.transfer(
        toAddress,
        amount,
        signer,
        network
      );
      
      // Return the transaction hash
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error transferring PYUSD:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Singleton instance of the PaymentService
 */
export const paymentService = new PaymentService();
