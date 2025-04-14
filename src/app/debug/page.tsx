"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccount } from "wagmi";
import { ConnectWallet } from "@/components/ui/connect-wallet";

// Define a response type
interface DebugResponse {
  success?: boolean;
  error?: string;
  details?: string;
  result?: Record<string, unknown>;
  text?: string;
  intent?: string;
  [key: string]: unknown;
}

export default function DebugPage() {
  const [message, setMessage] = useState("How can I send payment to someone?");
  const [response, setResponse] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();

  const testDirectDebug = async () => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      
      console.log("Testing direct debug endpoint with message:", message);
      const res = await fetch("/api/ai/assistant/debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          walletAddress: address || "0x123456789abcdef123456789abcdef123456789",
        }),
      });
      
      const data = await res.json();
      console.log("Debug response:", data);
      setResponse(data);
    } catch (err) {
      console.error("Error testing debug endpoint:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };
  
  const testAssistantAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);
      
      if (!address) {
        setError("Please connect your wallet first");
        return;
      }
      
      console.log("Testing assistant API with message:", message);
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Wallet ${address}`,
        },
        body: JSON.stringify({
          message,
        }),
      });
      
      const data = await res.json();
      console.log("Assistant API response:", data);
      setResponse(data);
    } catch (err) {
      console.error("Error testing assistant API:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">AI Assistant Debug</h1>
      
      <div className="mb-6">
        <ConnectWallet />
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test AI Assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Message:
              </label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={testDirectDebug} 
                disabled={loading}
                variant="outline"
              >
                {loading ? "Testing..." : "Test Direct Debug"}
              </Button>
              
              <Button 
                onClick={testAssistantAPI} 
                disabled={loading || !address}
              >
                {loading ? "Testing..." : "Test Assistant API"}
              </Button>
            </div>
            
            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-md">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
              </div>
            )}
            
            {response && (
              <div>
                <h3 className="font-semibold mb-2">Response:</h3>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Environment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Node Environment:</strong> {process.env.NODE_ENV}</p>
            <p><strong>Wallet Connected:</strong> {address ? "Yes" : "No"}</p>
            {address && (
              <p><strong>Wallet Address:</strong> {address}</p>
            )}
          </div>
          
          <div className="mt-4">
            <Button 
              onClick={async () => {
                try {
                  const res = await fetch("/api/ai/assistant/debug");
                  const data = await res.json();
                  setResponse(data);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unknown error");
                }
              }}
              variant="secondary"
              size="sm"
            >
              Check API Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 