import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { paymentService } from '@/lib/services/payments/payment-service';
import { userService } from '@/lib/services/users/user-service';
import type { PaymentStatus } from '@prisma/client';

// Define interface types for our mock data
interface MockUser {
  id: string;
  walletAddress: string;
  username: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockPayment {
  id: string;
  senderId: string;
  recipientId: string;
  amount: string;
  notes: string | null;
  status: PaymentStatus;
  transactionHash: string | null;
  blockNumber: number | null;
  blockTimestamp: Date | null;
  syncedAt: Date | null;
  syncRetries: number;
  syncError: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender?: MockUser;
  recipient?: MockUser;
  request?: MockRequest | null;
}

interface MockRequest {
  id: string;
  userId: string;
  amount: string;
  notes: string | null;
  status: string;
  expiresAt: Date | null;
  paymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: MockUser;
  fulfilledBy?: MockPayment | null;
}

// Mock Prisma
vi.mock('@/lib/db/prisma', () => {
  // Mock User data
  const mockUsers: Record<string, MockUser> = {
    'sender-id': {
      id: 'sender-id',
      walletAddress: '0x1234567890123456789012345678901234567890',
      username: 'sender',
      displayName: 'Sender User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'recipient-id': {
      id: 'recipient-id',
      walletAddress: '0x0987654321098765432109876543210987654321',
      username: 'recipient',
      displayName: 'Recipient User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Mock Payment data
  const mockPayments: Record<string, MockPayment> = {
    'payment-1': {
      id: 'payment-1',
      senderId: 'sender-id',
      recipientId: 'recipient-id',
      amount: '10',
      notes: 'Test payment 1',
      status: 'PENDING',
      transactionHash: 'tx-hash-1',
      blockNumber: null,
      blockTimestamp: null,
      syncedAt: null,
      syncRetries: 0,
      syncError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'payment-2': {
      id: 'payment-2',
      senderId: 'sender-id',
      recipientId: 'recipient-id',
      amount: '20',
      notes: 'Test payment 2',
      status: 'COMPLETED',
      transactionHash: 'tx-hash-2',
      blockNumber: 12345,
      blockTimestamp: new Date(),
      syncedAt: new Date(),
      syncRetries: 1,
      syncError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'payment-3': {
      id: 'payment-3',
      senderId: 'sender-id',
      recipientId: 'recipient-id',
      amount: '30',
      notes: 'Test payment 3',
      status: 'FAILED',
      transactionHash: 'tx-hash-3',
      blockNumber: 12346,
      blockTimestamp: new Date(),
      syncedAt: new Date(),
      syncRetries: 2,
      syncError: 'Transaction failed on blockchain',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Mock Request data
  const mockRequests: Record<string, MockRequest> = {
    'request-1': {
      id: 'request-1',
      userId: 'recipient-id',
      amount: '15',
      notes: 'Test request 1',
      status: 'OPEN',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paymentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'request-2': {
      id: 'request-2',
      userId: 'recipient-id',
      amount: '25',
      notes: 'Test request 2',
      status: 'FULFILLED',
      expiresAt: null,
      paymentId: 'payment-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Mocked Prisma Client
  return {
    prisma: {
      user: {
        findUnique: vi.fn((args) => {
          if (args.where.id) {
            return Promise.resolve(mockUsers[args.where.id] || null);
          }
          if (args.where.username) {
            return Promise.resolve(Object.values(mockUsers).find(u => u.username === args.where.username) || null);
          }
          if (args.where.walletAddress) {
            return Promise.resolve(Object.values(mockUsers).find(u => u.walletAddress.toLowerCase() === args.where.walletAddress.toLowerCase()) || null);
          }
          return Promise.resolve(null);
        }),
        create: vi.fn((args) => {
          const newUser = {
            id: `user-${Date.now()}`,
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as MockUser;
          mockUsers[newUser.id] = newUser;
          return Promise.resolve(newUser);
        }),
        update: vi.fn((args) => {
          const user = mockUsers[args.where.id];
          if (!user) {
            throw new Error(`User with ID ${args.where.id} not found`);
          }
          const updatedUser = { ...user, ...args.data, updatedAt: new Date() };
          mockUsers[args.where.id] = updatedUser;
          return Promise.resolve(updatedUser);
        }),
      },
      payment: {
        findUnique: vi.fn((args) => {
          if (args.where.id) {
            return Promise.resolve(mockPayments[args.where.id] || null);
          }
          if (args.where.transactionHash) {
            return Promise.resolve(Object.values(mockPayments).find(p => p.transactionHash === args.where.transactionHash) || null);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn((args) => {
          let payments = Object.values(mockPayments);
          
          // Filter by status
          if (args.where?.status) {
            payments = payments.filter(p => p.status === args.where.status);
          }
          
          // Filter by sender or recipient
          if (args.where?.OR) {
            payments = payments.filter(p => {
              return args.where.OR.some((condition: { senderId?: string; recipientId?: string }) => {
                if (condition.senderId) {
                  return p.senderId === condition.senderId;
                }
                if (condition.recipientId) {
                  return p.recipientId === condition.recipientId;
                }
                return false;
              });
            });
          }
          
          // Include related objects
          if (args.include) {
            payments = payments.map(p => {
              const result = { ...p } as MockPayment;
              if (args.include.sender) {
                result.sender = mockUsers[p.senderId];
              }
              if (args.include.recipient) {
                result.recipient = mockUsers[p.recipientId];
              }
              if (args.include.request) {
                result.request = Object.values(mockRequests).find(r => r.paymentId === p.id) || null;
              }
              return result;
            });
          }
          
          // Apply ordering
          if (args.orderBy?.createdAt === 'desc') {
            payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          
          // Apply limit
          if (args.take) {
            payments = payments.slice(0, args.take);
          }
          
          return Promise.resolve(payments);
        }),
        create: vi.fn((args) => {
          const newPayment = {
            id: `payment-${Date.now()}`,
            ...args.data,
            senderId: args.data.sender?.connect?.id || args.data.senderId,
            recipientId: args.data.recipient?.connect?.id || args.data.recipientId,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncRetries: 0,
          } as MockPayment;
          
          if (newPayment.sender) delete newPayment.sender;
          if (newPayment.recipient) delete newPayment.recipient;
          
          mockPayments[newPayment.id] = newPayment;
          return Promise.resolve(newPayment);
        }),
        update: vi.fn((args) => {
          const payment = mockPayments[args.where.id];
          if (!payment) {
            throw new Error(`Payment with ID ${args.where.id} not found`);
          }
          
          // Handle increment operations
          const incrementData: Record<string, number> = {};
          if (args.data.syncRetries?.increment) {
            incrementData.syncRetries = payment.syncRetries + args.data.syncRetries.increment;
            delete args.data.syncRetries;
          }
          
          const updatedPayment = { 
            ...payment, 
            ...args.data, 
            ...incrementData,
            updatedAt: new Date() 
          };
          mockPayments[args.where.id] = updatedPayment;
          return Promise.resolve(updatedPayment);
        }),
        updateMany: vi.fn((args) => {
          let count = 0;
          Object.keys(mockPayments).forEach(id => {
            const payment = mockPayments[id];
            if (args.where.status && payment.status === args.where.status) {
              mockPayments[id] = { ...payment, ...args.data, updatedAt: new Date() };
              count++;
            }
          });
          return Promise.resolve({ count });
        }),
      },
      request: {
        findUnique: vi.fn((args) => {
          if (args.where.id) {
            const request = mockRequests[args.where.id];
            if (request && args.include) {
              const result = { ...request } as MockRequest;
              if (args.include.user) {
                result.user = mockUsers[request.userId];
              }
              if (args.include.fulfilledBy) {
                result.fulfilledBy = request.paymentId ? mockPayments[request.paymentId] : null;
                if (result.fulfilledBy && args.include.fulfilledBy.include) {
                  if (args.include.fulfilledBy.include.sender) {
                    result.fulfilledBy.sender = mockUsers[result.fulfilledBy.senderId];
                  }
                  if (args.include.fulfilledBy.include.recipient) {
                    result.fulfilledBy.recipient = mockUsers[result.fulfilledBy.recipientId];
                  }
                }
              }
              return Promise.resolve(result);
            }
            return Promise.resolve(request || null);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn((args) => {
          let requests = Object.values(mockRequests);
          
          // Filter by status
          if (args.where?.status) {
            requests = requests.filter(r => r.status === args.where.status);
          }
          
          // Filter by user ID
          if (args.where?.userId) {
            requests = requests.filter(r => r.userId === args.where.userId);
          }
          
          // Filter by expiration
          if (args.where?.OR) {
            requests = requests.filter(r => {
              return args.where.OR.some((condition: { expiresAt?: { gt?: Date } | null }) => {
                if (condition.expiresAt === null) {
                  return r.expiresAt === null;
                }
                if (condition.expiresAt?.gt) {
                  return r.expiresAt && r.expiresAt > condition.expiresAt.gt;
                }
                return false;
              });
            });
          }
          
          // Include related objects
          if (args.include) {
            requests = requests.map(r => {
              const result = { ...r } as MockRequest;
              if (args.include.user) {
                result.user = mockUsers[r.userId];
              }
              return result;
            });
          }
          
          // Apply ordering
          if (args.orderBy?.createdAt === 'desc') {
            requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          
          // Apply limit
          if (args.take) {
            requests = requests.slice(0, args.take);
          }
          
          return Promise.resolve(requests);
        }),
        create: vi.fn((args) => {
          const newRequest = {
            id: `request-${Date.now()}`,
            ...args.data,
            userId: args.data.user?.connect?.id || args.data.userId,
            paymentId: args.data.fulfilledBy?.connect?.id || args.data.paymentId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as MockRequest;
          
          if ('user' in newRequest) delete newRequest.user;
          if ('fulfilledBy' in newRequest) delete newRequest.fulfilledBy;
          
          mockRequests[newRequest.id] = newRequest;
          return Promise.resolve(newRequest);
        }),
        update: vi.fn((args) => {
          const request = mockRequests[args.where.id];
          if (!request) {
            throw new Error(`Request with ID ${args.where.id} not found`);
          }
          
          // Handle connect operations for related entities
          const connectData: Record<string, string | null> = {};
          if (args.data.fulfilledBy?.connect?.id) {
            connectData.paymentId = args.data.fulfilledBy.connect.id;
            delete args.data.fulfilledBy;
          }
          
          const updatedRequest = { 
            ...request, 
            ...args.data, 
            ...connectData,
            updatedAt: new Date() 
          };
          mockRequests[args.where.id] = updatedRequest;
          return Promise.resolve(updatedRequest);
        }),
        updateMany: vi.fn((args) => {
          let count = 0;
          
          // Expire requests
          if (args.where.status === 'OPEN' && args.where.expiresAt?.lt) {
            Object.keys(mockRequests).forEach(id => {
              const request = mockRequests[id];
              if (request.status === 'OPEN' && request.expiresAt && request.expiresAt < args.where.expiresAt.lt) {
                mockRequests[id] = { ...request, status: 'EXPIRED', updatedAt: new Date() };
                count++;
              }
            });
          }
          
          return Promise.resolve({ count });
        }),
      },
      $transaction: vi.fn((callback) => {
        return callback(prisma);
      }),
    },
  };
});

// Mock blockchain service
vi.mock('@/lib/services/blockchain/gcp-blockchain-rpc', () => ({
  gcpBlockchainRpcService: {
    getProvider: vi.fn().mockReturnValue({
      getTransactionReceipt: vi.fn().mockResolvedValue({
        blockNumber: 12345,
        status: 1,
      }),
      getBlock: vi.fn().mockResolvedValue({
        timestamp: Math.floor(Date.now() / 1000),
      }),
    }),
  },
}));

vi.mock('@/lib/services/blockchain/pyusd-token', () => ({
  PyusdTokenService: vi.fn().mockImplementation(() => ({
    getTokenContract: vi.fn().mockReturnValue({
      filters: {
        Transfer: vi.fn().mockReturnValue({}),
      },
      on: vi.fn(),
      off: vi.fn(),
    }),
  })),
}));

describe('Database Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PaymentService Tests', () => {
    it('should create a payment', async () => {
      const result = await paymentService.createPayment({
        senderWalletAddress: '0x1234567890123456789012345678901234567890',
        recipientUsername: 'recipient',
        amount: '15',
        notes: 'Test payment',
      });

      expect(result).toBeDefined();
      expect(result.payment).toBeDefined();
      expect(result.payment?.status).toBe('PENDING');
      expect(result.payment?.amount).toBe('15');
      expect(result.payment?.notes).toBe('Test payment');
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should record a transaction hash for a payment', async () => {
      const paymentId = 'payment-1';
      const txHash = 'new-tx-hash';

      await paymentService.recordTransactionHash(paymentId, txHash);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({ transactionHash: txHash }),
        })
      );
    });

    it('should confirm a payment', async () => {
      const paymentId = 'payment-1';
      const txHash = 'tx-hash-1';

      await paymentService.confirmPayment(paymentId, txHash);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('should fail a payment', async () => {
      const paymentId = 'payment-1';

      await paymentService.failPayment(paymentId);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({ 
            status: 'FAILED',
          }),
        })
      );
    });

    it('should get a payment by ID', async () => {
      const paymentId = 'payment-1';
      const payment = await paymentService.getPaymentById(paymentId);

      expect(payment).toBeDefined();
      expect(payment?.id).toBe(paymentId);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
        })
      );
    });

    it('should get a payment by transaction hash', async () => {
      const txHash = 'tx-hash-2';
      const payment = await paymentService.getPaymentByTransactionHash(txHash);

      expect(payment).toBeDefined();
      expect(payment?.transactionHash).toBe(txHash);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionHash: txHash },
        })
      );
    });
  });

  describe('UserService Tests', () => {
    it('should find a user by wallet address', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const user = await userService.getUserByWalletAddress(walletAddress);

      expect(user).toBeDefined();
      expect(user?.walletAddress.toLowerCase()).toBe(walletAddress.toLowerCase());
      expect(prisma.user.findUnique).toHaveBeenCalled();
    });

    it('should create a user if not found by wallet address', async () => {
      const walletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const user = await userService.getUserByWalletAddress(walletAddress);

      if (!user) {
        const createdUser = await userService.createUser({
          walletAddress: walletAddress,
          username: `user_${Date.now()}`,
          displayName: 'New User',
        });
        
        expect(createdUser).toBeDefined();
        expect(createdUser.walletAddress.toLowerCase()).toBe(walletAddress.toLowerCase());
        expect(prisma.user.create).toHaveBeenCalled();
      }
    });

    it('should check if a username is taken', async () => {
      const existingUsername = 'sender';
      const nonExistingUsername = 'nonexistent';

      const result1 = await userService.isUsernameTaken(existingUsername);
      const result2 = await userService.isUsernameTaken(nonExistingUsername);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should update a user profile', async () => {
      const userId = 'sender-id';
      const updates = {
        displayName: 'Updated Name',
      };

      const updatedUser = await userService.updateUserProfile(userId, updates);

      expect(updatedUser).toBeDefined();
      expect(updatedUser.displayName).toBe('Updated Name');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: updates,
        })
      );
    });

    it('should get payment history for a user', async () => {
      const userId = 'sender-id';
      const history = await userService.getUserPaymentHistory(userId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });
  });

  describe('Payment Request Tests', () => {
    it('should create a payment request', async () => {
      const userId = 'recipient-id';
      const amount = '15';
      const notes = 'Test request';

      const request = await paymentService.createPaymentRequest(userId, amount, notes);

      expect(request).toBeDefined();
      expect(request.amount).toBe(amount);
      expect(request.notes).toBe(notes);
      expect(request.status).toBe('OPEN');
      expect(prisma.request.create).toHaveBeenCalled();
    });

    it('should get open payment requests', async () => {
      const requests = await paymentService.getOpenPaymentRequests();

      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].status).toBe('OPEN');
      
      // Just verify it was called - the implementation details may change
      expect(prisma.request.findMany).toHaveBeenCalled();
    });

    it('should update expired requests', async () => {
      const result = await paymentService.updateExpiredRequests();

      expect(prisma.request.updateMany).toHaveBeenCalled();
      expect(typeof result).toBe('number');
    });
  });
}); 