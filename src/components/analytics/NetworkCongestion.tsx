'use client';

// Uncomment the Network import
import { Network } from '@/types/network'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// Removed unused Tabs, Skeleton, Badge, Select imports
import { Info } from 'lucide-react'; // Import Info icon

// Uncomment the network prop
export function NetworkCongestion({ network }: { network: Network }) {
  // Log the network prop to satisfy the linter
  console.log('NetworkCongestion component rendered for network:', network);

  return (
    <div className="space-y-6"> 
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium">Network Congestion Dashboard</CardTitle>
              <CardDescription>
                Monitor Ethereum network congestion and PYUSD&apos;s impact on the network
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <Info className="w-12 h-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Work In Progress</h3>
            <p className="text-gray-600">
              This Network Congestion analytics section is currently under development.
              <br />
              We are working on optimizing data retrieval for a better experience.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
