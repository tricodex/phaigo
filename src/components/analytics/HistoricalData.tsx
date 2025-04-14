'use client';

import { Network } from '@/types/network';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function HistoricalData({ network }: { network: Network }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical Data</CardTitle>
        <CardDescription>
          Historical trends for PYUSD on the {network} network
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Info className="w-12 h-12 text-blue-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Work In Progress</h3>
          <p className="text-gray-600">
            This Historical Data section is currently under development.
            <br />
            We are optimizing the data retrieval process.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
