"use client";

import { useState, useRef, useEffect } from "react";
import { useAssistant } from "./use-assistant";
import { AssistantInput } from "./assistant-input";
import { AssistantMessage } from "./assistant-message";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssistantProps {
  initialOpen?: boolean;
  className?: string;
}

export function Assistant({ initialOpen = false, className }: AssistantProps) {
  // Get the current timestamp for component renders (helps debug re-renders)
  const renderTimestamp = useRef(Date.now());
  
  console.log(`🤖 Assistant component rendering (${renderTimestamp.current}) with initialOpen:`, initialOpen);
  
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const { messages, isLoading, error, sendMessage, resetConversation } = useAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Debug state on every render
  console.log(`📊 Assistant state (${renderTimestamp.current}):`, { 
    isOpen, 
    isMinimized, 
    messagesCount: messages.length, 
    isLoading, 
    hasError: !!error 
  });
  
  // Handle sending message
  const handleSendMessage = async (text: string, action?: string) => {
    console.log(`🗣️ Assistant - handleSendMessage called with text: "${text}"${action ? ` and action: ${action}` : ''}`);
    
    try {
      await sendMessage(text);
    } catch (err) {
      console.error("⛔ Error in handleSendMessage:", err);
    }
  };
  
  // Handle resetting conversation
  const handleResetConversation = () => {
    console.log("🔄 Resetting conversation");
    resetConversation();
  };
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  const baseButtonClasses = "fixed bottom-4 right-4 rounded-full size-14 shadow-lg z-50";

  if (!isOpen) {
    return (
      <Button
        onClick={() => {
          console.log("🔓 Opening assistant");
          setIsOpen(true);
        }}
        className={`${baseButtonClasses} assistant-button font-righteous`}
        aria-label="Open AI Assistant"
      >
        <span className="mr-0.5">AI</span>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300",
        isMinimized ? "w-72" : "w-96 md:w-[30rem]",
        className
      )}
    >
      <Card className="shadow-xl">
        <CardHeader className="p-3 flex flex-row items-center space-y-0 border-b">
          <CardTitle className="text-base flex-1">phaigo chat</CardTitle>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                console.log("🔄 Toggling minimize state to:", !isMinimized);
                setIsMinimized(!isMinimized);
              }}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                console.log("🔒 Closing assistant");
                setIsOpen(false);
              }}
              title="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
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
              {isLoading && (
                <div className="flex items-center justify-center py-4" data-testid="loading-indicator">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-muted-foreground">Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        )}
        
        <CardFooter className={cn(
          "bg-gray-50 dark:bg-gray-900 p-3",
          isMinimized && "rounded-b-lg"
        )}>
          {isMinimized ? (
            <p className="text-sm text-muted-foreground truncate">
              {isLoading 
                ? "Thinking..." 
                : messages[messages.length - 1]?.role === "assistant" 
                  ? messages[messages.length - 1]?.content
                  : "Ask me anything..."}
            </p>
          ) : (
            <div className="w-full flex flex-col gap-2">
              <AssistantInput
                onSubmit={handleSendMessage}
                loading={isLoading}
                className="py-0"
              />
              
              {/* Reset button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleResetConversation}
                  disabled={isLoading}
                >
                  <RefreshCw className="size-3 mr-1" />
                  Reset conversation
                </Button>
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
