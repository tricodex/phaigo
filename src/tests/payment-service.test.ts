import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PaymentService, CreatePaymentParams } from '@/lib/services/payments/payment-service';
import { userService } from '@/lib/services/users/user-service';
import { prisma } from '@/lib/db/prisma';
import { mockReset } from 'vitest-mock-extended';
import type { User, Payment, Request } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/db/prisma', () => {
  const mock = {
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    request: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mock)),
  };
  return { prisma: mock };
});

vi.mock('@/lib/services/users/user-service', () => ({
  userService: {
    findOrCreateUser: vi.fn(),
    getUserByUsername: vi.fn(),
    validateWalletAddress: vi.fn(),
  }
}));

// Mock data
const mockSender = {
  id: 'sender-id',
  username: 'sender_username',
  walletAddress: '0xb067fb16afcabf8a8974a35cbcee243b8fdf0ea1',
  displayName: 'Sender User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecipient = {
  id: 'recipient-id',
  username: 'recipient_username',
  walletAddress: '0x9ac44c3c76b06c96a3932bb15d2f3a6d9c45badb',
  displayName: 'Recipient User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPayment = {
  id: 'payment-id',
  senderId: mockSender.id,
  recipientId: mockRecipient.id,
  amount: '10',
  notes: 'Test payment',
  status: 'PENDING',
  transactionHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRequest = {
  id: 'request-id',
  userId: mockRecipient.id,
  amount: '10',
  notes: 'Test request',
  status: 'OPEN',
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  paymentId: null,
};

describe('PaymentService', () => {
  let paymentService: PaymentService;
  
  beforeEach(() => {
    paymentService = new PaymentService();
    vi.resetAllMocks();
    vi.clearAllMocks();
    
    // Default mock implementations
    (userService.validateWalletAddress as any).mockReturnValue({ 
      valid: true, 
      address: mockSender.walletAddress 
    });
    (userService.findOrCreateUser as any).mockResolvedValue(mockSender);
    (userService.getUserByUsername as any).mockResolvedValue(mockRecipient);
    (prisma.payment.create as any).mockResolvedValue(mockPayment);
    (prisma.payment.findUnique as any).mockResolvedValue(mockPayment);
    (prisma.payment.update as any).mockResolvedValue({
      ...mockPayment,
      status: 'COMPLETED',
      transactionHash: '0x123',
    });
    (prisma.request.findUnique as any).mockResolvedValue(mockRequest);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: mockRecipient.username,
        amount: '10',
        notes: 'Test payment',
      };
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.payment).toEqual(mockPayment);
      expect(userService.findOrCreateUser).toHaveBeenCalledWith(mockSender.walletAddress.toLowerCase());
      expect(userService.getUserByUsername).toHaveBeenCalledWith(mockRecipient.username);
      expect(prisma.payment.create).toHaveBeenCalled();
    });
    
    it('should return error if sender wallet address is missing', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: '',
        recipientUsername: mockRecipient.username,
        amount: '10',
      };
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_SENDER');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should return error if recipient username is missing', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: '',
        amount: '10',
      };
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_RECIPIENT');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should return error if amount is missing', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: mockRecipient.username,
        amount: '',
      };
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_AMOUNT');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should return error if wallet address is invalid', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: 'invalid-address',
        recipientUsername: mockRecipient.username,
        amount: '10',
      };
      
      (userService.validateWalletAddress as any).mockReturnValue({
        valid: false,
        address: 'invalid-address',
        error: 'Invalid Ethereum address format',
      });
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_SENDER_ADDRESS');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should return error if recipient user is not found', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: 'non-existent-user',
        amount: '10',
      };
      
      (userService.getUserByUsername as any).mockResolvedValue(null);
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('RECIPIENT_NOT_FOUND');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should return error if trying to send payment to self', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: mockSender.username,
        amount: '10',
      };
      
      (userService.getUserByUsername as any).mockResolvedValue(mockSender);
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('SELF_PAYMENT');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    
    it('should fulfill a request when requestId is provided', async () => {
      // Arrange
      const params: CreatePaymentParams = {
        senderWalletAddress: mockSender.walletAddress,
        recipientUsername: mockRecipient.username,
        amount: '10',
        requestId: mockRequest.id,
      };
      
      // Act
      const result = await paymentService.createPayment(params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(prisma.request.findUnique).toHaveBeenCalledWith({
        where: { id: mockRequest.id },
      });
      expect(prisma.request.update).toHaveBeenCalled();
    });
  });
  
  describe('confirmPayment', () => {
    it('should confirm a payment successfully', async () => {
      // Mocks for the test
      const mockPayment = {
        id: 'payment-id',
        status: 'PENDING',
        transactionHash: null
      };
      
      const mockUpdatedPayment = {
        ...mockPayment,
        status: 'COMPLETED',
        transactionHash: 'tx-hash-123'
      };
      
      // Set up mocks for findUnique (called first to check if payment exists)
      vi.spyOn(prisma.payment, 'findUnique')
        .mockResolvedValueOnce({
          ...mockPayment,
          include: { request: true, sender: true }
        } as any);
      
      // Set up mock for update (called to update payment status)
      vi.spyOn(prisma.payment, 'update')
        .mockResolvedValueOnce(mockUpdatedPayment as any);
      
      // Call the service method
      const result = await paymentService.confirmPayment('payment-id', 'tx-hash-123');
      
      // Verify success response
      expect(result.success).toBe(true);
      expect(result.payment).toEqual(mockUpdatedPayment);
      
      // Verify the prisma calls were correct
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: { request: true, sender: true }
      });
      
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: {
          status: 'COMPLETED',
          transactionHash: 'tx-hash-123',
          updatedAt: expect.any(Date)
        }
      });
    });
    
    it('should return error if payment ID is missing', async () => {
      // Act
      const result = await paymentService.confirmPayment('', '0x123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_PAYMENT_ID');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
    
    it('should return error if transaction hash is missing', async () => {
      // Act
      const result = await paymentService.confirmPayment(mockPayment.id, '');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_TX_HASH');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
    
    it('should return error if payment is not found', async () => {
      // Arrange
      (prisma.payment.findUnique as any).mockResolvedValue(null);
      
      // Act
      const result = await paymentService.confirmPayment('non-existent-id', '0x123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('PAYMENT_NOT_FOUND');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
  
  describe('failPayment', () => {
    it('should mark a payment as failed successfully', async () => {
      // Arrange
      const paymentId = mockPayment.id;
      
      (prisma.payment.update as any).mockResolvedValue({
        ...mockPayment,
        status: 'FAILED',
      });
      
      // Act
      const result = await paymentService.failPayment(paymentId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.payment).toHaveProperty('status', 'FAILED');
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId },
        include: { request: true }
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
        },
      });
    });
    
    it('should return error if payment ID is missing', async () => {
      // Act
      const result = await paymentService.failPayment('');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_PAYMENT_ID');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
    
    it('should return error if payment is not found', async () => {
      // Arrange
      (prisma.payment.findUnique as any).mockResolvedValue(null);
      
      // Act
      const result = await paymentService.failPayment('non-existent-id');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('PAYMENT_NOT_FOUND');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
  
  describe('getPaymentById', () => {
    it('should retrieve a payment by ID', async () => {
      // Act
      const payment = await paymentService.getPaymentById(mockPayment.id);
      
      // Assert
      expect(payment).toEqual(mockPayment);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        include: {
          sender: true,
          recipient: true,
          request: true,
        },
      });
    });
    
    it('should return null if payment ID is missing', async () => {
      // Act
      const payment = await paymentService.getPaymentById('');
      
      // Assert
      expect(payment).toBeNull();
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });
    
    it('should return null if payment is not found', async () => {
      // Arrange
      (prisma.payment.findUnique as any).mockResolvedValue(null);
      
      // Act
      const payment = await paymentService.getPaymentById('non-existent-id');
      
      // Assert
      expect(payment).toBeNull();
    });
  });
  
  describe('getPaymentByTransactionHash', () => {
    it('should retrieve a payment by transaction hash', async () => {
      // Arrange
      const transactionHash = '0x123';
      (prisma.payment.findUnique as any).mockResolvedValue({
        ...mockPayment,
        transactionHash,
      });
      
      // Act
      const payment = await paymentService.getPaymentByTransactionHash(transactionHash);
      
      // Assert
      expect(payment).toHaveProperty('transactionHash', transactionHash);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { transactionHash },
        include: {
          sender: true,
          recipient: true,
          request: true,
        },
      });
    });
    
    it('should return null if transaction hash is missing', async () => {
      // Act
      const payment = await paymentService.getPaymentByTransactionHash('');
      
      // Assert
      expect(payment).toBeNull();
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });
  });
  
  describe('updateExpiredRequests', () => {
    it('should update expired requests', async () => {
      // Arrange
      const mockUpdateCount = 5;
      (prisma.request.updateMany as any).mockResolvedValue({ count: mockUpdateCount });
      
      // Act
      const count = await paymentService.updateExpiredRequests();
      
      // Assert
      expect(count).toBe(mockUpdateCount);
      expect(prisma.request.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'OPEN',
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });
    });
  });
}); 