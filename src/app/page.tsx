/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import Image from "next/image";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { ConnectWallet } from '@/components/ui/connect-wallet';
import { PageWrapper } from "@/components/layouts/PageWrapper";
import { Network } from '@/types/network';
import { useAccount } from 'wagmi';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, SendHorizontal, Users, Wallet, CheckCircle, Shield, Zap, RefreshCw } from 'lucide-react';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { Header } from '@/components/layouts/Header';
import Link from 'next/link';
import { useWeb3Modal } from '@web3modal/wagmi/react';

export default function HomePage() {
  return (
    <PageWrapper>
      <HomePageContent />
    </PageWrapper>
  );
}

function HomePageContent() {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    username: '',
    displayName: ''
  });
  const router = useRouter();
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<Network>('sepolia');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { open } = useWeb3Modal();

  // Parallax effect for mountain image
  useEffect(() => {
    const handleScroll = () => {
      if (parallaxRef.current) {
        const scrollY = window.scrollY;
        const element = parallaxRef.current;
        const speed = 0.2; // Subtle parallax speed
        element.style.transform = `translateY(${scrollY * speed}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Effect to try to get the user profile when wallet is connected
  useEffect(() => {
    const checkUserProfile = async () => {
      if (isConnected && address) {
        try {
          setLoading(true);
          const response = await fetch(`/api/users?walletAddress=${address}`);
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              // User exists, redirect to dashboard
              router.push('/dashboard');
            }
          }
        } catch (error) {
          console.error('Error checking user profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    checkUserProfile();
  }, [isConnected, address, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleCreateProfileClick = () => {
    if (!isConnected) {
      open?.();
      return;
    }
    checkUserProfileAndProceed();
  };

  // Function to check profile and either redirect or show input
  const checkUserProfileAndProceed = async () => {
    if (isConnected && address) {
      try {
        setLoading(true);
        const response = await fetch(`/api/users?walletAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            router.push('/dashboard');
          } else {
            setShowUsernameInput(true); // Show input if profile doesn't exist
          }
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
        setShowUsernameInput(true); // Default to showing input on error
      } finally {
        setLoading(false);
      }
    } else {
      // Should ideally not happen if called after connection check
      handleCreateProfileClick(); // Re-trigger connection if somehow disconnected
    }
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formData.username.trim()) {
      createProfile();
    }
  };

  const createProfile = async () => {
    if (!formData.username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username for your profile.",
        variant: "destructive"
      });
      return;
    }

    if (!address) return;

    if (!isConnected) {
      open?.();
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to create a profile.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          username: formData.username,
          displayName: formData.displayName || formData.username,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Profile Created",
          description: "Your profile has been created successfully!",
        });
        router.push('/dashboard');
      } else {
        toast({
          title: "Error Creating Profile",
          description: data.error || "Something went wrong",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Error",
        description: "Failed to create profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <SendHorizontal className="text-blue-600" />,
      title: "Instant Payments",
      description: "Send PYUSD to anyone, anywhere, instantly with minimal fees.",
      bgImage: "/f1.jpg"
    },
    {
      icon: <PyusdIcon size={24} className="text-blue-600" />,
      title: "Dollar Stable",
      description: "PYUSD maintains a 1:1 peg with the US Dollar for reliable value transfer.",
      bgImage: "/f2.jpg"
    },
    {
      icon: <Users className="text-blue-600" />,
      title: "Username System",
      description: "Send money to simple usernames instead of complex wallet addresses.",
      bgImage: "/f3.jpg"
    },
    {
      icon: <Wallet className="text-blue-600" />,
      title: "Secure Storage",
      description: "Your funds remain in your wallet until you choose to send them.",
      bgImage: "/f4.jpg"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.5s]">
      {/* Header with navbar */}
      <Header transparent />

      <main className="flex-1">
        {/* Hero section */}
        <section className="hero-container relative py-16 pb-40 md:pb-48 md:pt-24 bg-gradient-to-b from-white to-blue-50">
          {/* Mountain background spanning across the bottom of the hero */}
          <div ref={parallaxRef} className="hero-mountain-bg"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row gap-12 items-center mb-8 md:mb-16">
              <div className="w-full md:w-1/2 space-y-8">
                <div className="space-y-6">
                  <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent motion-translate-y-in-[10px] motion-opacity-in-[0%] motion-duration-[0.7s]">
                    Payments
                    <br />
                    <span className="italic">Made Simple</span>
                  </h1>
                  <p className="text-xl text-muted-foreground motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[100ms]">
                    Send and receive PayPal USD stablecoin with a beautiful, intuitive interface.
                    No complicated addresses, just simple usernames.
                  </p>
                  
                  <div className="pt-4 flex flex-col sm:flex-row gap-4 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.8s] motion-delay-[200ms]">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all text-white"
                      onClick={handleCreateProfileClick}
                      disabled={loading}
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    
                    <Link href="/about">
                      <Button
                        size="lg"
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        About
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              
              <div className="w-full md:w-1/2 flex justify-center motion-translate-x-in-[10px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[200ms]">
                <div className="payment-demo-card relative w-full max-w-md bg-white p-8 rounded-xl">
                  {/* Background image for payment card */}
                  <div className="payment-demo-bg"></div>
                  
                  {/* Mountain overlay image pointing at payment */}
                  <div className="mountain-overlay motion-translate-x-in-[50px] motion-opacity-in-[0%] motion-duration-[1s] motion-delay-[500ms]"></div>
                  
                  {/* Demo payment UI */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6 motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
                      <Image src="/logo.png" alt="Phaigo Logo" width={32} height={32} />

                      <div>
                        <h3 className="font-bold text-lg">Send PYUSD</h3>
                        <p className="text-sm text-muted-foreground">Fast & secure payments</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[200ms]">
                        <p className="text-sm text-muted-foreground">To</p>
                        <p className="font-medium">@friend</p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[300ms]">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <div className="flex items-center gap-2">
                          <PyusdIcon size={20} />
                          <p className="font-medium text-lg">25.00 PYUSD</p>
                        </div>
                      </div>
                    </div>
                    
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[400ms]">
                      Send Payment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-16 motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
              Features
            </h2>
            
            <div className="feature-card-container">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="feature-card motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s]" 
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div 
                    className="feature-card-bg" 
                    style={{ backgroundImage: `url(${feature.bgImage})` }}
                  ></div>
                  <div className="feature-card-overlay"></div>
                  <div className="feature-card-content">
                    <div className="feature-card-icon">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2 font-features">{feature.title}</h3>
                    <p className="text-sm text-gray-200">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* CTA section */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-blue-600 to-purple-100 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6 motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
              Ready?
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[100ms]">
              Create your account in seconds and start sending Payments today.
            </p>
            
            {showUsernameInput ? (
              <Card className="max-w-md mx-auto shadow-xl motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.5s]">
                <CardHeader>
                  <h3 className="text-2xl font-heading font-semibold text-gray-900">Create Your Profile</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-left block text-gray-700" htmlFor="username">
                        Username<span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="username"
                        placeholder="Choose a unique username"
                        value={formData.username}
                        onChange={handleInputChange}
                        onKeyPress={handleInputKeyPress}
                        className="w-full"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-left block text-gray-700" htmlFor="displayName">
                        Display Name (optional)
                      </label>
                      <Input
                        id="displayName"
                        placeholder="Your public display name"
                        value={formData.displayName}
                        onChange={handleInputChange}
                        className="w-full"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={createProfile}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    disabled={loading}
                  >
                    {loading ? 'Creating Profile...' : 'Create Profile'}
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Button
                size="lg"
                onClick={handleCreateProfileClick}
                className="bg-white text-blue-700 hover:bg-blue-50 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[200ms]"
                disabled={loading}
              >
                Create Your Profile
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </section>
      </main>
      
      <footer className="border-t py-8 bg-white">
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