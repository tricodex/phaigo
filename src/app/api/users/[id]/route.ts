import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services/users/user-service';
import { z } from 'zod';

// Schema for updateUser
const updateUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().min(1).max(50).optional(),
  profileImage: z.string().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
});

// Get user by ID
export async function GET(
  request: NextRequest,
) {
  try {
    // Get user ID from URL params
    const userId = request.nextUrl.pathname.split('/')[3];
    
    // Try to find user by username
    const user = await userService.getUserByUsername(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Return user with wallet address included but maintain it for safety
    return NextResponse.json({ 
      user: {
        ...user,
        // Make sure wallet address is normalized to checksum format
        walletAddress: user.walletAddress
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// Update user
export async function PATCH(
  request: NextRequest,
) {
  try {
    const body = await request.json();
    // Get user ID from URL params
    const userId = request.nextUrl.pathname.split('/')[3];
    
    // Validate request body
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 });
    }
    
    // Transform empty email string to null before updating
    const dataToUpdate = {
      ...validation.data,
      email: validation.data.email === '' ? null : validation.data.email
    };
    
    // Get user to verify wallet address
    const existingUser = await userService.getUserByUsername(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Verify ownership through authorization header with wallet address
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Wallet ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const walletAddress = authHeader.replace('Wallet ', '').toLowerCase();
    if (existingUser.walletAddress.toLowerCase() !== walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Update user
    const updatedUser = await userService.updateUserProfile(existingUser.id, dataToUpdate);
    
    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error instanceof Error && error.message.includes('already taken')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
