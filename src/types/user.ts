/**
 * User type definitions for the Phaigo application
 */

/**
 * User profile interface representing a user in the system
 */
export interface User {
  id: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
  walletAddress: string;
  profileImage?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Form data for updating user profiles
 */
export interface ProfileFormData {
  username: string;
  displayName: string;
  email: string;
  bio: string;
}

/**
 * Public user profile with limited information
 */
export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  walletAddress: string;
} 