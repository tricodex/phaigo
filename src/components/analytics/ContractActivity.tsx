'use client';

import { Network } from '@/types/network';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';

// Removed analyticsService import
// import { singleton } from '@/lib/utils/singleton';
// import { PyusdAnalyticsService, ContractActivityData } from '@/lib/services/blockchain/analytics';
// const analyticsService = singleton(PyusdAnalyticsService);

export function ContractActivity({ network }: { network: Network }) {
  // Removed state variables
  // const [isLoading, setIsLoading] = useState(true);
  // const [activityData, setActivityData] = useState<ContractActivityData[]>([]);

  // Removed useEffect hook
  /*
  useEffect(() => {
    const fetchData = async () => {
      // ... removed fetching logic ...
    };
    fetchData();
  }, [network]);
  */

  // Removed helper functions
  /*
  const getExplorerLink = (txHash: string) => { ... }; 
  const formatMethodName = (name: string) => { ... };
  */

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Activity</CardTitle>
        <CardDescription>
          Recent interactions with the PYUSD contract on the {network} network
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Replaced Table with WIP Message */}
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Info className="w-12 h-12 text-blue-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Work In Progress</h3>
          <p className="text-gray-600">
            This Contract Activity section is currently under development.
            <br />
            We are optimizing the data fetching process.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
