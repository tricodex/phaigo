/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PageWrapper } from '@/components/layouts/PageWrapper';
import { Header } from '@/components/layouts/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Zap, Sparkles, Globe, ArrowRight, Github, Target, Smartphone, WalletCards, DollarSign } from 'lucide-react';
import PyusdIcon from '@/components/ui/pyusd-icon';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <PageWrapper>
      <AboutPageContent />
    </PageWrapper>
  );
}

function AboutPageContent() {
  const parallaxRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col min-h-screen bg-background motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.5s]">
      {/* Header */}
      <Header transparent />

      {/* Hero section */}
      <section className="hero-container relative py-16 pb-40 md:pb-48 md:pt-24 bg-gradient-to-b from-white to-blue-50">
        {/* Mountain background parallax effect */}
        <div ref={parallaxRef} className="hero-mountain-bg"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-6">
            <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent motion-translate-y-in-[10px] motion-opacity-in-[0%] motion-duration-[0.7s]">
              About 
            </h1>
            <p className="text-xl text-muted-foreground motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[100ms]">
              Simplifying cryptocurrency payments with PYUSD, powered by Google Cloud&apos;s Blockchain RPC service.
            </p>
          </div>
        </div>
      </section>

      {/* Mission section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="w-full md:w-1/2 motion-translate-x-in-[-10px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[100ms]">
              <div className="relative h-[400px] w-full overflow-hidden rounded-2xl shadow-xl">
                <Image 
                  src="/hero.png" 
                  alt="Phaigo Mission" 
                  fill 
                  style={{ objectFit: 'cover', objectPosition: 'center' }}
                  className="brightness-90 hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <h3 className="text-white text-2xl font-heading mb-2">The Mission</h3>
                  <p className="text-white/90 text-sm">Bringing crypto payments to everyone</p>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-1/2 space-y-6 motion-translate-x-in-[10px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[200ms]">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
                Making Crypto <span className="text-blue-600">Simple</span>
              </h2>
              
              <p className="text-gray-700 leading-relaxed">
                Cryptocurrency should be accessible to everyone, not just tech enthusiasts. Phaigo was born from a simple idea: what if sending crypto payments was as easy as texting a friend?
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                The platform leverages the stability of PYUSD stablecoin and the power of Google Cloud&apos;s Blockchain RPC service to deliver a seamless payment experience. No more complicated wallet addresses or confusing interfaces – just simple usernames and instant transactions.
              </p>
              
              <div className="pt-4">
                <Link href="/dashboard">
                  <Button 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white" 
                    size="lg"
                  >
                    <Image src="/logo.png" alt="Phaigo Logo" width={20} height={20} className="mr-2" />
                    <span className="logo-text text-lg bg-gradient-to-r from-white to-white bg-clip-text text-transparent">phaigo</span>
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology section */}
      <section className="py-20 bg-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4 motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
              Powered by Advanced Technology
            </h2>
            <p className="text-gray-700 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[100ms]">
              The platform combines cutting-edge blockchain technology with modern web standards to create a seamless payment experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* GCP Blockchain RPC */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[150ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">GCP Blockchain RPC</h3>
                <p className="text-gray-600 text-sm">
                  Leveraging Google Cloud&apos;s reliable and scalable Blockchain RPC service for fast transaction processing and network interactions.
                </p>
              </CardContent>
            </Card>
            
            {/* PYUSD Integration */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[200ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <PyusdIcon size={24} />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">PYUSD Integration</h3>
                <p className="text-gray-600 text-sm">
                  Integrated with PayPal USD stablecoin for stable value transfer with 1:1 peg to the US Dollar.
                </p>
              </CardContent>
            </Card>
            
            {/* Next.js 15 & React 19 */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[250ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Modern Framework</h3>
                <p className="text-gray-600 text-sm">
                  Built with Next.js 15 and React 19, utilizing the latest web technologies for optimal performance and user experience.
                </p>
              </CardContent>
            </Card>
            
            {/* Security */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[300ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Advanced Security</h3>
                <p className="text-gray-600 text-sm">
                  Implemented with robust security protocols to protect user data and transactions at every step.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* // --- START: New Analytics Dashboard Section */}
      <section className="py-20 bg-blue-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="w-full md:w-1/2 space-y-6 motion-translate-x-in-[-10px] motion-opacity-in-[0%] motion-duration-[0.7s]">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
                Uncover Insights with the <span className="text-blue-600">Analytics Dashboard</span>
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Go beyond simple payments with our comprehensive Analytics Dashboard. Monitor PYUSD activity, track network performance, and gain deeper insights into transaction flows.
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Overview:</strong> Get a high-level view of PYUSD statistics.</li>
                <li><strong>Transactions:</strong> Analyze volume, frequency, and patterns.</li>
                <li><strong>Network Congestion:</strong> Understand gas fees and network health.</li>
                <li><strong>Contract Activity:</strong> Monitor interactions with the PYUSD contract.</li>
                <li><strong>Historical Data:</strong> Explore long-term trends.</li>
                <li><strong>Deep Dive:</strong> Leverage powerful GCP trace methods (e.g., <code className="text-sm bg-gray-200 px-1 rounded">debug_traceTransaction</code>) for detailed transaction analysis (wallet connection required).</li>
              </ul>
              <div className="pt-4">
                <Link href="/analytics">
                  <Button 
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50" 
                    size="lg"
                  >
                    <span>Explore Analytics</span>
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="w-full md:w-1/2 motion-translate-x-in-[10px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[100ms]">
               <div className="relative h-[400px] w-full overflow-hidden rounded-2xl shadow-xl">
                 <Image 
                  src="/analytics.png" 
                  alt="Analytics Dashboard Preview" 
                  fill 
                  style={{ objectFit: 'cover', objectPosition: 'center' }}
                  className="brightness-95 hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
               </div>
            </div>
          </div>
        </div>
      </section>
      {/* // --- END: New Analytics Dashboard Section */}

      {/* Road Ahead section */}      
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4 motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
              The Road Ahead
            </h2>
            <p className="text-gray-700 motion-translate-y-in-[5px] motion-opacity-in-[0%] motion-duration-[0.6s] motion-delay-[100ms]">
              The vision for the future of simple crypto payments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Fee System */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[150ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Sustainable Model</h3>
                <p className="text-gray-600 text-sm">
                  Implementing a fair and transparent fee structure to support platform growth and new features.
                </p>
              </CardContent>
            </Card>

            {/* Mobile App */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[200ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Mobile Experience</h3>
                <p className="text-gray-600 text-sm">
                  Developing native mobile applications for iOS and Android for payments on the go.
                </p>
              </CardContent>
            </Card>

            {/* Wallet Evolution */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[250ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <WalletCards className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Full Wallet Features</h3>
                <p className="text-gray-600 text-sm">
                  Expanding beyond payments to become a comprehensive, user-friendly crypto wallet solution.
                </p>
              </CardContent>
            </Card>

            {/* Continuous Improvement */}
            <Card className="bg-white border-blue-100 motion-translate-y-in-[12px] motion-opacity-in-[0%] motion-duration-[0.7s] motion-delay-[300ms]">
              <CardContent className="p-6">
                <div className="w-12 h-12 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-features font-semibold mb-2">Ongoing Innovation</h3>
                <p className="text-gray-600 text-sm">
                  Continuously adding features like merchant tools, multi-chain support, and more based on user feedback.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="motion-translate-y-in-[8px] motion-opacity-in-[0%] motion-duration-[0.6s]">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">
              Join the Future of Payments
            </h2>
            <p className="text-gray-700 mb-8">
              Experience the simplicity of PYUSD payments with Phaigo. Create your account today and start sending cryptocurrency as easily as sending a message.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white" 
                  size="lg"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              
              <Button 
                variant="outline"
                size="lg"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Github className="mr-2 h-5 w-5" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
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
    </div>
  );
}