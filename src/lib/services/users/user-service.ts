import { prisma } from '@/lib/db/prisma';
import type { User, Payment, Request } from '@prisma/client';
import { singleton } from '@/lib/utils/singleton';

export interface UserProfile {
  username: string;
  displayName?: string | null;
  walletAddress: string;
  profileImage?: string | null;
  bio?: string | null;
  email?: string | null;
}

export interface UserLookupResult {
  user: User | null;
  exists: boolean;
  error?: string;
}

export class UserService {
  /**
   * Create a new user profile
   */
  async createUser(profile: UserProfile): Promise<User> {
    try {
      const normalizedAddress = profile.walletAddress.toLowerCase();
      // Check if user with this wallet address already exists
      const existingUser = await prisma.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });

      if (existingUser) {
        console.log(`User already exists for wallet ${normalizedAddress}, returning existing user`);
        return existingUser;
      }

      // Check if username is already taken
      const usernameExists = await prisma.user.findUnique({
        where: { username: profile.username }
      });

      if (usernameExists) {
        throw new Error(`Username "${profile.username}" is already taken`);
      }

      // Create new user
      const newUser = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          profileImage: profile.profileImage,
          bio: profile.bio,
          email: profile.email
        }
      });
      
      console.log(`Successfully created new user with wallet ${normalizedAddress} and username ${profile.username}`);
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find or create a user based on wallet address
   * Generates a unique username if needed
   */
  async findOrCreateUser(walletAddress: string): Promise<User> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }
      
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Try to find existing user
      const existingUser = await prisma.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });

      if (existingUser) {
        console.log(`Found existing user for wallet ${normalizedAddress}: ${existingUser.username}`);
        return existingUser;
      }

      console.log(`No user found for wallet ${normalizedAddress}, creating new user...`);
      
      // Generate unique username based on address
      const baseUsername = `user_${normalizedAddress.slice(2, 8)}`;
      let username = baseUsername;
      let counter = 1;
      
      // Check if username is taken
      while (await this.isUsernameTaken(username)) {
        username = `${baseUsername}_${counter}`;
        counter++;
      }

      console.log(`Generated unique username ${username} for wallet ${normalizedAddress}`);

      // Create new user with generated username
      const newUser = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          username,
          displayName: username
        }
      });
      
      console.log(`Successfully created new user with wallet ${normalizedAddress} and username ${username}`);
      return newUser;
    } catch (error) {
      console.error('Error finding or creating user:', error);
      throw error;
    }
  }

  /**
   * Safely ensures a user exists for a wallet address without throwing errors
   * Returns object with user (if found/created) and status information
   */
  async ensureUserExists(walletAddress: string): Promise<UserLookupResult> {
    if (!walletAddress) {
      return { 
        user: null, 
        exists: false, 
        error: 'Wallet address is required' 
      };
    }
    
    try {
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Try to find existing user
      const existingUser = await prisma.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });

      if (existingUser) {
        return { user: existingUser, exists: true };
      }

      // Generate unique username based on address
      const baseUsername = `user_${normalizedAddress.slice(2, 8)}`;
      let username = baseUsername;
      let counter = 1;
      
      // Check if username is taken
      while (await this.isUsernameTaken(username)) {
        username = `${baseUsername}_${counter}`;
        counter++;
      }

      // Create new user with generated username
      const newUser = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          username,
          displayName: username
        }
      });
      
      return { user: newUser, exists: false };
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      return { 
        user: null, 
        exists: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating user' 
      };
    }
  }

  /**
   * Check if a username is already taken
   */
  async isUsernameTaken(username: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { username }
    });
    return !!user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<User> {
    try {
      // If updating username, check if it's taken
      if (profile.username) {
        const existingUser = await prisma.user.findUnique({
          where: { username: profile.username }
        });
        
        if (existingUser && existingUser.id !== userId) {
          throw new Error(`Username "${profile.username}" is already taken`);
        }
      }

      return await prisma.user.update({
        where: { id: userId },
        data: {
          ...(profile.username && { username: profile.username }),
          ...(profile.displayName && { displayName: profile.displayName }),
          ...(profile.profileImage !== undefined && { profileImage: profile.profileImage }),
          ...(profile.bio !== undefined && { bio: profile.bio }),
          ...(profile.email !== undefined && { email: profile.email })
        }
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Get user by wallet address
   */
  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      if (!walletAddress) {
        console.warn('Attempted to get user with empty wallet address');
        return null;
      }
      
      const normalizedAddress = walletAddress.toLowerCase();
      return await prisma.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });
    } catch (error) {
      console.error('Error getting user by wallet address:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      if (!username) {
        console.warn('Attempted to get user with empty username');
        return null;
      }
      
      return await prisma.user.findUnique({
        where: { username }
      });
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * Get a user's payment history
   */
  async getUserPaymentHistory(userId: string): Promise<Payment[]> {
    try {
      if (!userId) {
        console.warn('Attempted to get payment history with empty user ID');
        return [];
      }
      
      return await prisma.payment.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          sender: true,
          recipient: true
        }
      });
    } catch (error) {
      console.error('Error getting user payment history:', error);
      throw error;
    }
  }

  /**
   * Get a user's payment requests
   */
  async getUserRequests(userId: string): Promise<Request[]> {
    try {
      if (!userId) {
        console.warn('Attempted to get requests with empty user ID');
        return [];
      }
      
      return await prisma.request.findMany({
        where: { userId },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      console.error('Error getting user requests:', error);
      throw error;
    }
  }

  /**
   * Validate wallet address is properly formed
   */
  validateWalletAddress(address: string): { valid: boolean; address: string; error?: string } {
    if (!address || typeof address !== 'string') {
      return { valid: false, address: '', error: 'Empty or invalid wallet address' };
    }
    
    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { valid: false, address, error: 'Invalid Ethereum address format' };
    }
    
    return { valid: true, address: address.toLowerCase() };
  }
}

// Export singleton instance
export const userService = singleton(UserService);
