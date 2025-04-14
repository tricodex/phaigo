"use client";

import { useState, useEffect } from 'react';

export interface Profile {
  id: string;
  username: string;
  bio?: string;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export function useProfile(walletAddress?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!walletAddress) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // In a real app, this would be an API call to your backend
        // For now, we'll simulate it with a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if there's a profile for this wallet (simulate API response)
        // In a real app, you would fetch from your backend API
        const mockProfile = localStorage.getItem(`profile-${walletAddress}`);
        
        if (mockProfile) {
          setProfile(JSON.parse(mockProfile));
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [walletAddress]);

  const createProfile = async (username: string, bio?: string): Promise<Profile> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real app, this would be an API call to your backend
      // For now, we'll simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newProfile: Profile = {
        id: `profile-${Date.now()}`,
        username,
        bio,
        walletAddress,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save the profile to localStorage (this simulates a database)
      localStorage.setItem(`profile-${walletAddress}`, JSON.stringify(newProfile));
      
      setProfile(newProfile);
      return newProfile;
    } catch (err) {
      console.error('Error creating profile:', err);
      const error = err instanceof Error ? err : new Error('Failed to create profile');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'username' | 'bio'>>): Promise<Profile> => {
    if (!profile || !walletAddress) {
      throw new Error('No profile to update or wallet not connected');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real app, this would be an API call to your backend
      // For now, we'll simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedProfile: Profile = {
        ...profile,
        ...updates,
        updatedAt: new Date()
      };
      
      // Save the updated profile to localStorage
      localStorage.setItem(`profile-${walletAddress}`, JSON.stringify(updatedProfile));
      
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      console.error('Error updating profile:', err);
      const error = err instanceof Error ? err : new Error('Failed to update profile');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    profile,
    isLoading,
    error,
    createProfile,
    updateProfile
  };
}

export default useProfile;