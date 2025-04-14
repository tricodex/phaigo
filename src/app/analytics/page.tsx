/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Image from 'next/image';
// import { ConnectWallet } from '@/components/ui/connect-wallet';
// import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { Network } from '@/types/network';
import { Toaster } from '@/components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageWrapper } from "@/components/layouts/PageWrapper";
import { DeepDive } from '@/components/analytics/Analytics';
import { 
  PyusdOverview, 
  TransactionAnalytics, 
  NetworkCongestion, 
  ContractActivity, 
  HistoricalData, 
} from '@/components/analytics';
import { Header } from '@/components/layouts/Header';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <PageWrapper>
      <AnalyticsContent />
    </PageWrapper>
  );
}

function AnalyticsContent() {
  const { isConnected } = useAccount(); // Check if connected
  const [currentNetwork, setCurrentNetwork] = useState<Network>('mainnet');
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline flex items-center mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">PYUSD Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive analytics for PYUSD stablecoin powered by Google Cloud&apos;s Blockchain RPC service
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="deep-dive">Deep Dive</TabsTrigger>
            <TabsTrigger value="congestion">Network Congestion</TabsTrigger>
            <TabsTrigger value="activity">Contract Activity</TabsTrigger>
            <TabsTrigger value="historical">Historical Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <PyusdOverview network={currentNetwork} />
          </TabsContent>
          
          <TabsContent value="transactions">
            <TransactionAnalytics network={currentNetwork} />
          </TabsContent>
          
          <TabsContent value="deep-dive">
            {isConnected ? (
              <DeepDive network={currentNetwork} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                Please connect your wallet to use the Deep Dive features.
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="congestion">
            <NetworkCongestion network={currentNetwork} />
          </TabsContent>
          
          <TabsContent value="activity">
            <ContractActivity network={currentNetwork} />
          </TabsContent>
          
          <TabsContent value="historical">
            <HistoricalData network={currentNetwork} />
          </TabsContent>
        </Tabs>
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
