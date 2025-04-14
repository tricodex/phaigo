'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Network } from '@/types/network';
import { PageWrapper } from "@/components/layouts/PageWrapper";
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Send, ArrowLeft, Copy, Mail } from 'lucide-react';
import Link from 'next/link';
import SendPaymentForm from '@/components/payments/SendPaymentForm';
import Image from 'next/image';
import { Header } from '@/components/layouts/Header';

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  bio: string | null;
  email: string | null;
}

export default function UserProfile() {
  const params = useParams();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentNetwork, setCurrentNetwork] = useState<Network>('sepolia');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState('about');

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!username) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${username}`);
        
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.user);
          
          // Check if this is the user's own profile
          if (isConnected && address) {
            const myProfileResponse = await fetch(`/api/users?walletAddress=${address}`);
            if (myProfileResponse.ok) {
              const myProfileData = await myProfileResponse.json();
              if (myProfileData.user && myProfileData.user.username === username) {
                setIsOwnProfile(true);
              }
            }
          }
        } else {
          toast({
            title: 'User Not Found',
            description: `No user found with username: ${username}`,
            variant: 'destructive',
          });
          // Redirect to home after showing error
          setTimeout(() => router.push('/'), 3000);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [username, address, isConnected, toast, router]);

  // Handle copy username to clipboard
  const copyUsernameToClipboard = () => {
    if (userProfile?.username) {
      navigator.clipboard.writeText(userProfile.username)
        .then(() => {
          toast({
            title: 'Username Copied',
            description: `@${userProfile.username} copied to clipboard`,
          });
        })
        .catch((err) => {
          console.error('Failed to copy username:', err);
        });
    }
  };

  // Handle redirect to edit profile
  const handleEditProfile = () => {
    router.push('/profile');
  };

  return (
    <PageWrapper>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <Header />

        {/* Main content */}
        <main className="flex-1 container mx-auto px-4 py-8">
          <Link 
            href={isOwnProfile ? "/dashboard" : "/"} 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>{isOwnProfile ? "Back to Dashboard" : "Back to Home"}</span>
          </Link>
          
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white animate-pulse">
                <RefreshCw className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Loading profile information...</p>
            </div>
          ) : userProfile ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  {/* Profile Image */}
                  <div className="flex-shrink-0">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-6xl font-bold">
                      {userProfile.displayName?.[0]?.toUpperCase() || userProfile.username[0].toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Profile Info */}
                  <div className="flex-grow text-center md:text-left">
                    <h1 className="text-3xl font-bold">
                      {userProfile.displayName || userProfile.username}
                    </h1>
                    <div className="flex items-center justify-center md:justify-start gap-1 text-gray-500 mt-1 cursor-pointer" onClick={copyUsernameToClipboard}>
                      <span>@{userProfile.username}</span>
                      <Copy className="h-3.5 w-3.5" />
                    </div>
                    
                    {userProfile.bio && (
                      <p className="mt-4 text-gray-700">
                        {userProfile.bio}
                      </p>
                    )}
                    
                    {userProfile.email && (
                      <div className="mt-4 flex items-center justify-center md:justify-start text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        <span>{userProfile.email}</span>
                      </div>
                    )}
                    
                    <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                      {isOwnProfile ? (
                        <Button 
                          onClick={handleEditProfile}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        >
                          Edit Profile
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => router.push(`/pay/${userProfile.username}`)}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Payment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {!isOwnProfile && (
                <Card>
                  <CardHeader>
                    <CardTitle>Send Payment to {userProfile.displayName || userProfile.username}</CardTitle>
                    <CardDescription>
                      Send PYUSD directly to @{userProfile.username}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SendPaymentForm 
                      senderAddress={address} 
                      network={currentNetwork}
                      initialRecipient={userProfile.username}
                      onSuccess={() => {
                        toast({
                          title: 'Payment Sent',
                          description: `Payment to @${userProfile.username} was successful`,
                        });
                        router.push('/dashboard');
                      }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="max-w-md mx-auto shadow-lg border-red-100">
              <CardHeader>
                <CardTitle className="text-red-600">User Not Found</CardTitle>
                <CardDescription>
                  We couldn&apos;t find a user with the username: {username}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>The user you&apos;re looking for doesn&apos;t exist or has changed their username.</p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => router.push('/')}
                >
                  Return Home
                </Button>
              </CardFooter>
            </Card>
          )}
        </main>

        <footer className="border-t py-6 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

                <span className="logo-text text-gray-800 text-lg">phaigo</span>
              </div>
              
              <p className="text-muted-foreground text-sm">
                &copy; {new Date().getFullYear()} Phaigo - Powered by <a href="https://www.pyusd.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PYUSD</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </PageWrapper>
  );
}
