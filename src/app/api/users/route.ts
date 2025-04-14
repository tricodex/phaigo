import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services/users/user-service';
import { z } from 'zod';

// Schema for createUser
const createUserSchema = z.object({
  walletAddress: z.string().min(42).max(42),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(50).optional(),
  profileImage: z.string().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

// Schema for wallet address lookup
const walletAddressSchema = z.object({
  walletAddress: z.string().min(42).max(42),
});

// Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 });
    }
    
    // Create user
    const user = await userService.createUser(validation.data);
    
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error instanceof Error && error.message.includes('already taken')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// Get user by wallet address or create if not exists
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.nextUrl.searchParams.get('walletAddress');
    const username = request.nextUrl.searchParams.get('username');
    
    if (!walletAddress && !username) {
      return NextResponse.json({ error: 'Either walletAddress or username must be provided' }, { status: 400 });
    }
    
    let user;
    
    if (walletAddress) {
      // Validate wallet address
      const validation = walletAddressSchema.safeParse({ walletAddress });
      if (!validation.success) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
      }
      
      // Find or create user
      user = await userService.findOrCreateUser(walletAddress);
    } else if (username) {
      // Get user by username
      user = await userService.getUserByUsername(username);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error getting/creating user:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
