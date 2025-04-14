'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConnectWallet } from '@/components/ui/connect-wallet';
import { Network } from '@/types/network';
import { PageWrapper } from "@/components/layouts/PageWrapper";
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { RefreshCw, User, Mail, Info, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { User as UserType, ProfileFormData } from '@/types/user';
import { Header } from '@/components/layouts/Header';

export default function ProfilePage() {
  return (
    <PageWrapper>
      <ProfileContent />
    </PageWrapper>
  );
}

function ProfileContent() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<Network>('sepolia');
  const [user, setUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    displayName: '',
    email: '',
    bio: '',
  });

  // Fetch user profile on load
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/users?walletAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
            setFormData({
              username: data.user.username || '',
              displayName: data.user.displayName || '',
              email: data.user.email || '',
              bio: data.user.bio || '',
            });
          } else {
            router.push('/'); // Redirect to homepage if no user profile
          }
        } else {
          router.push('/'); // Redirect to homepage on error
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
  }, [address, isConnected, router, toast]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !address) {
      toast({
        title: 'Error',
        description: 'User information or wallet not available',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setSaving(true);
      
      // Only include fields that have been changed
      const updates: Partial<ProfileFormData> = {};
      if (formData.displayName !== user.displayName) updates.displayName = formData.displayName;
      if (formData.email !== user.email) updates.email = formData.email;
      if (formData.bio !== user.bio) updates.bio = formData.bio;
      
      // Special case for username as it needs to be unique
      if (formData.username !== user.username) updates.username = formData.username;
      
      // If nothing changed, just show success and return
      if (Object.keys(updates).length === 0) {
        toast({
          title: 'No Changes',
          description: 'No changes were made to your profile',
        });
        setSaving(false);
        return;
      }
      
      // Update profile
      const response = await fetch(`/api/users/${user.username}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${address}`,
        },
        body: JSON.stringify(updates),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated',
        });
        
        // Update user state with new data
        setUser(responseData.user);
        
        // Check if username was changed, redirect to dashboard if so
        if (updates.username && updates.username !== user.username) {
          router.push('/dashboard');
        }
      } else {
        toast({
          title: 'Update Failed',
          description: responseData.error || 'Failed to update profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Redirect to login if not connected
  if (!isConnected && !loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b py-4 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
            </div>
            <ConnectWallet size="sm" showAddress={true} />
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto shadow-lg border-blue-100">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to access your profile
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <ConnectWallet size="lg" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b py-4 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

              <h2 className="logo-text text-2xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">phaigo</h2>
            </div>
            <div className="flex items-center gap-3">
              <NetworkStatus currentNetwork={currentNetwork} onNetworkChange={setCurrentNetwork} />
              <ConnectWallet size="sm" showAddress={true} />
            </div>
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white animate-pulse">
              <RefreshCw className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">Loading your profile...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Back to Dashboard</span>
          </Link>
          
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>
                Update your profile information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                    {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Username
                    </label>
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be your unique identifier for payments
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="displayName" className="text-sm font-medium flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Display Name
                    </label>
                    <Input
                      id="displayName"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your public display name shown to others
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email (Optional)
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll never share your email with anyone else
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="bio" className="text-sm font-medium flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    Bio (Optional)
                  </label>
                  <Textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tell others a bit about yourself
                  </p>
                </div>
                
                <div className="pt-4 flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-800 mb-1">Wallet Address</h3>
            <p className="text-blue-700 text-sm break-all font-mono">{address}</p>
            <p className="text-xs text-blue-600 mt-2">
              This is your connected wallet address. It cannot be changed.
            </p>
          </div>
        </div>
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
      
      <Toaster />
    </div>
  );
}
