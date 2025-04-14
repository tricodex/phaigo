/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useRef } from "react";
import { useAssistant } from "@/components/ai/use-assistant";
import { AssistantInput } from "@/components/ai/assistant-input";
import { AssistantMessage } from "@/components/ai/assistant-message";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Bot } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectWallet } from "@/components/ui/connect-wallet";
import Image from "next/image";

export default function AssistantPage() {
  const { messages, isLoading, error, sendMessage, resetConversation } = useAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useAccount();
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card className="shadow-md">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Image src="/logo.png" alt="Phaigo Logo" width={16} height={16} />
              </div>
              <CardTitle>phaigo chat</CardTitle> {/* phaigo Assistant */}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetConversation}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Reset conversation
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 border-b">
          <div className="min-h-[50vh] max-h-[60vh] overflow-y-auto">
            <div className="ai-assistant-messages flex flex-col divide-y divide-black/5 dark:divide-white/5">
              {messages.map((message) => (
                <AssistantMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  actions={message.actions}
                  timestamp={message.timestamp}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="bg-gray-50 dark:bg-gray-900 p-6">
          {isConnected ? (
            <AssistantInput
              onSubmit={sendMessage}
              loading={isLoading}
              className="w-full"
            />
          ) : (
            <div className="w-full text-center py-4">
              <p className="text-muted-foreground mb-4">
                Connect your wallet to chat with the phaigo Assistant
              </p>
              <ConnectWallet />
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
