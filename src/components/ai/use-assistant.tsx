/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { ExternalLink, CreditCard, FileText, BarChart } from "lucide-react";
import { ethers } from "ethers";
import { pyusdTokenService } from "@/lib/services/blockchain/pyusd-token";
import { isProduction } from "@/lib/config/environment";
import { useNetworkStore } from '@/stores/networkStore';

// ---> Define type for response data
interface AssistantResponseData {
  text: string;
  functionName?: string;
  functionArgs?: {
    recipient?: string;
    amount?: string;
    description?: string;
    [key: string]: unknown;
  };
  intent?: string;
  requestId?: string;
  // Add any other potential fields from the API response
}

type MessageRole = "user" | "assistant";

interface MessageAction {
  label: string;
  href?: string;
  onClick?: () => void;
  isPrimary?: boolean;
  icon?: React.ReactNode;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  actions?: MessageAction[];
}

interface AssistantState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  resetConversation: () => void;
}

// Safety timeout in milliseconds - will force loading to false if it gets stuck
const LOADING_SAFETY_TIMEOUT = 10000;

// Debug message before component renders with actions
const DEBUG_MESSAGES = true;

// Welcome message for reset
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hello! I'm your phaigo Assistant. I can help you send payments, create payment requests, check your balance, and more. How can I assist you today?",
  timestamp: new Date()
};

export function useAssistant(): AssistantState {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const latestResponseDataRef = useRef<AssistantResponseData | null>(null);
  
  // Use a ref to track loading state to avoid React state update issues
  const loadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const { currentNetwork } = useNetworkStore();
  
  // Safety timeout ID
  const safetyTimeoutRef = useRef<number | null>(null);
  
  // Keep track if the component is mounted
  const isMounted = useRef(true);
  
  useEffect(() => {
    // ---> Standard mount ref setup
    isMounted.current = true;
    console.log("useAssistant: Component mounted.");
    return () => {
      console.log("useAssistant: Component unmounting.");
      isMounted.current = false;
      // Clear any pending safety timeouts
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  // Log loading state changes for debugging
  useEffect(() => {
    console.log(`🔄 Loading state updated in React: ${isLoading}`);
  }, [isLoading]);
  
  // Debug log messages when they change
  useEffect(() => {
    if (DEBUG_MESSAGES && messages.length > 0) {
      console.log(`📋 Current messages (${messages.length}):`, 
        messages.map(m => ({
          role: m.role,
          content: m.content.substring(0, 30) + '...',
          hasActions: m.actions?.length || 0
        }))
      );
    }
  }, [messages]);
  
  // Function to update loading state that ensures both ref and state are in sync
  const updateLoadingState = useCallback((loading: boolean) => {
    console.log(`🔄 Setting loading state to: ${loading}`);
    
    // Update the ref immediately
    loadingRef.current = loading;
    
    // Update React state
    setIsLoading(loading);
    
    // If turning on loading, set a safety timeout
    if (loading) {
      // Clear any existing timeout
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current);
      }
      
      // Set new safety timeout
      safetyTimeoutRef.current = window.setTimeout(() => {
        console.log("⚠️ Safety timeout triggered - forcing loading state to false");
        if (loadingRef.current) {
          updateLoadingState(false);
        }
      }, LOADING_SAFETY_TIMEOUT);
    } else {
      // Clear timeout when turning off loading
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    }
  }, []);

  // Helper function to create an action button for request links
  const createRequestViewAction = useCallback((requestId: string) => {
    if (!requestId) {
      console.error("Attempted to create request view action with empty requestId");
      return {
        label: "View Requests",
        href: `/request/list`,
        isPrimary: true,
        icon: <FileText className="w-4 h-4" />
      };
    }
    
    const href = `/request/${requestId}`;
    console.log(`🔗 Creating request view link to: ${href}`);
    
    const action: MessageAction = {
      label: "View Request",
      href,
      isPrimary: true,
      icon: <FileText className="w-4 h-4" />
    };
    
    console.log(`🔗 Created request view action:`, action);
    return action;
  }, []);

  // Extracted function to handle payment execution - NOW READS FROM REF
  const executePayment = useCallback(async () => {
    console.log("🚀 Entering executePayment function (reading from ref)");
    
    // ---> Read data from the ref
    const responseData = latestResponseDataRef.current;
    
    if (!responseData || !responseData.functionArgs) {
      console.error("❌ executePayment: No response data or functionArgs found in ref.");
      setError("Could not retrieve payment details. Please try again.");
      // Add an error message to the chat
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "I couldn't retrieve the payment details needed to proceed. Please try asking again.",
          timestamp: new Date()
        }
      ]);
      return;
    }
    
    // ---> Extract args from ref data
    const { recipient, amount, description } = responseData.functionArgs;

    try {
      console.log("Executing payment with args from ref:", { recipient, amount, description });
      
      // Only proceed if we have recipient and amount
      if (!recipient || !amount) {
        throw new Error("Missing recipient or amount for payment in stored data");
      }
      
      const executeResponse = await fetch("/api/ai/assistant/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Wallet ${address}`
        },
        body: JSON.stringify({
          action: "send_payment",
          recipient,
          amount,
          description: description || `Payment to ${recipient}` // Add fallback description
        })
      });
      
      console.log("Execute API response status:", executeResponse.status);
      
      if (!executeResponse.ok) {
        // Attempt to parse error from response body
        let apiErrorMsg = `Execute error: ${executeResponse.status}`;
        try {
          const errorJson = await executeResponse.json();
          if (errorJson && errorJson.error) {
            apiErrorMsg = errorJson.error;
          }
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(apiErrorMsg);
      }
      
      const result = await executeResponse.json();
      console.log("✅ Execute API result object:", JSON.stringify(result, null, 2)); // Log the full result object
      
      // Trigger wallet signing if transaction data is included
      if (result.transactionData && result.transactionData.needsWalletSignature) {
        try {
          console.log("💸 Transaction data detected, preparing wallet interaction:", result.transactionData);
          
          // Add a pending confirmation message
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Please confirm the transaction in your wallet to send ${result.transactionData.amount} PYUSD.`,
              timestamp: new Date()
            }
          ]);
          
          // Get the network from the store instead of hardcoding
          const network = currentNetwork;
          console.log(`💸 Using network: ${network}`);
          
          // Check if ethereum provider exists
          if (!window.ethereum) {
            console.error("❌ No Ethereum provider found! Make sure your wallet extension is installed.");
            throw new Error("No Ethereum provider found. Please install a wallet extension.");
          }
          
          console.log("💸 Window.ethereum detected, getting provider...");
          
          // Get provider and signer from ethers
          try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            console.log("💸 Provider created, requesting signer...");
            
            const signer = await provider.getSigner();
            console.log(`💸 Signer obtained: ${await signer.getAddress()}`);
            
            // Execute the actual blockchain transaction
            console.log("💸 Initiating blockchain transaction with:", {
              to: result.transactionData.recipientAddress,
              amount: result.transactionData.amount,
              network
            });
            
            const tx = await pyusdTokenService.transfer(
              result.transactionData.recipientAddress,
              result.transactionData.amount,
              signer,
              network
            );
            
            console.log("✅ Transaction submitted:", tx);
            console.log("Transaction hash:", tx.hash);

            // ---> Log before the check
            console.log(`➡️ Reached point to check for hash recording. tx.hash: ${!!tx.hash}, result.payment?.id: ${result.payment?.id}`);

            // ---> Check and record hash in DB
            if (tx.hash && result.payment?.id) {
              try {
                console.log(`📞 Calling API to record transaction hash...`);
                console.log(`   - Payment ID: ${result.payment.id}`);
                console.log(`   - Transaction Hash: ${tx.hash}`);
                
                const requestBody = JSON.stringify({ 
                  paymentId: result.payment.id,
                  transactionHash: tx.hash 
                });
                console.log(`   - Request Body: ${requestBody}`);

                const recordHashResponse = await fetch('/api/payments/record-hash', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: requestBody,
                });

                console.log(`   - API Response Status: ${recordHashResponse.status}`);

                if (!recordHashResponse.ok) {
                  let errorBody = '';
                  try {
                    errorBody = await recordHashResponse.text();
                  } catch { /* ignore */ }
                  console.error(`❌ Failed to record transaction hash. Status: ${recordHashResponse.status}, Body: ${errorBody}`);
                  // Log error but proceed, as UI update is primary
                } else {
                  console.log(`✅ Transaction hash recorded successfully via API for payment ${result.payment.id}`);
                  // Optionally trigger a refresh of transaction history if needed
                  // Example: queryClient.invalidateQueries(['transactionHistory']);
                }
              } catch (recordError) {
                console.error("❌ Error calling /api/payments/record-hash:", recordError);
                 // Log error but proceed
              }
            } else {
              // ---> ADDED ELSE BLOCK FOR DEBUGGING
              console.warn("⚠️ Skipping hash recording API call. Missing data:", {
                hasTxHash: !!tx.hash,
                hasPaymentId: !!result.payment?.id,
                paymentIdValue: result.payment?.id
              });
              // <--- END ADDED ELSE BLOCK
            }
            // <--- END MODIFIED BLOCK
            
            // Add transaction success message
            const newActions: MessageAction[] = [];
            
            if (tx.hash) {
              // Build blockchain explorer URL
              const explorerBaseUrl = network === 'mainnet'
                ? 'https://etherscan.io/tx/'
                : 'https://sepolia.etherscan.io/tx/';
              
              newActions.push({
                label: "View Transaction",
                href: `${explorerBaseUrl}${tx.hash}`,
                isPrimary: true,
                icon: <ExternalLink className="w-4 h-4" />
              });
            }
            
            // Add success message with transaction link
            setMessages(prev => [
              ...prev,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Payment successfully submitted to the blockchain! The transaction is now being processed.`,
                timestamp: new Date(),
                actions: newActions.length > 0 ? newActions : undefined
              }
            ]);
          } catch (signerError) {
            console.error("❌ Error getting signer or provider:", signerError);
            // Add more specific error message to UI
            const message = signerError instanceof Error ? signerError.message : "Could not connect to wallet provider.";
            throw new Error(`Wallet interaction failed: ${message}`);
          }
        } catch (txError) {
          console.error("❌ Transaction error:", txError);
          // Add transaction failure message
          const message = txError instanceof Error ? txError.message : "Unknown blockchain error.";
          throw new Error(`Transaction failed: ${message}`);
        }
      } else {
        // Handle case where execution API succeeded but no wallet signature needed (e.g., internal transfer?)
        console.log("✅ Payment execution successful (no wallet signature required).");
        // Add payment success message 
        if (isMounted.current) {
          const newActions: MessageAction[] = [];
          
          if (result.transactionHash) {
            const network = isProduction ? 'mainnet' : 'sepolia';
            const explorerUrl = network === 'mainnet'
              ? `https://etherscan.io/tx/${result.transactionHash}`
              : `https://sepolia.etherscan.io/tx/${result.transactionHash}`;
              
            newActions.push({
              label: "View Transaction",
              href: explorerUrl,
              isPrimary: true,
              icon: <ExternalLink className="w-4 h-4" />
            });
          }
          
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Payment prepared successfully!`,
              timestamp: new Date(),
              actions: newActions.length > 0 ? newActions : undefined
            }
          ]);
        }
      }
    } catch (error) {
      console.error("Payment execution error catch block:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to execute payment";
      setError(errorMsg);
      
      // Add error message
      if (isMounted.current) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `I'm sorry, but there was an error processing your payment: ${errorMsg}`,
            timestamp: new Date()
          }
        ]);
      }
    }
  }, [address, setError, setMessages, isMounted, pyusdTokenService, isProduction, latestResponseDataRef, currentNetwork]);

  const sendMessage = useCallback(async (message: string) => {
    if (!address) {
      console.log("No wallet address available, cannot send message");
      setError("Please connect your wallet to use the assistant");
      return;
    }
    
    if (!message.trim()) return;
    
    console.log("🚀 Starting message send - setting isLoading to true");
    // Start loading
    updateLoadingState(true);
    setError(null);
    
    try {
      console.log("📤 Sending message to assistant API:", message);
      
      // Add user message immediately before the API call
      const userMessageId = Date.now().toString();
      const userMessage = {
        id: userMessageId,
        role: "user" as const,
        content: message,
        timestamp: new Date()
      };
      
      // Update messages state with the user message first
      setMessages(prev => [...prev, userMessage]);
      
      // Send message to API
      console.log("📡 Making fetch request to /api/ai/assistant with wallet:", address.slice(0, 8) + "...");
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Wallet ${address}`
        },
        body: JSON.stringify({ message })
      });
      
      console.log("📥 API response status:", response.status);
      
      // CRITICAL: Immediately stop loading after receiving the API response
      // Do this BEFORE any other async operations, including json parsing
      console.log("🛑 API response received - setting isLoading to false");
      updateLoadingState(false);
      
      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          console.log("❌ API error details:", errorData);
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          console.log("Failed to parse error JSON:", e);
          // Ignore JSON parsing errors
        }
        throw new Error(errorMessage);
      }
      
      // Now parse the JSON AFTER we've already set loading to false
      console.log("⏳ Parsing API response body...");
      const data = await response.json();
      console.log("✅ JSON Parsed. Proceeding to process data:", data);

      // ---> STORE THE RAW RESPONSE DATA IN THE REF
      latestResponseDataRef.current = data;
      console.log("✅ Stored latest response data in ref.");

      // --- Wrap data processing in a try/catch ---
      let newMessage: Message | null = null;
      let processingError: Error | null = null;
      
      try {
        // Process the assistant response
        console.log("🔍 Processing assistant response");
        console.log("FULL RESPONSE DATA:", data);
        console.log("Function name:", typeof data.functionName, data.functionName);
        console.log("Function args:", data.functionArgs);
        console.log("Function args type:", typeof data.functionArgs);
        console.log("Function args stringified:", JSON.stringify(data.functionArgs));
        console.log("Request ID:", data.requestId);
        console.log("Intent:", data.intent);
        
        // Ensure functionArgs is available
        let validatedFunctionArgs = {
          recipient: "",
          amount: "",
          description: ""
        };
        
        try {
          // Try to extract function args if available
          if (data.functionArgs) {
            console.log("Function args contents:", Object.keys(data.functionArgs));
            
            if (typeof data.functionArgs === 'object') {
              validatedFunctionArgs = {
                recipient: data.functionArgs.recipient || "",
                amount: data.functionArgs.amount || "",
                description: data.functionArgs.description || ""
              };
              console.log("Validated function args:", validatedFunctionArgs);
            } else {
              console.log("Function args is not an object, trying to parse...");
              try {
                // Try parsing if it's a string
                const parsed = typeof data.functionArgs === 'string' 
                  ? JSON.parse(data.functionArgs)
                  : data.functionArgs;
                  
                validatedFunctionArgs = {
                  recipient: parsed.recipient || "",
                  amount: parsed.amount || "",
                  description: parsed.description || ""
                };
                console.log("Parsed function args:", validatedFunctionArgs);
              } catch (parseError) {
                console.error("Error parsing function args:", parseError);
              }
            }
          } else if (data.intent === 'pay') {
            // Extract from text if no functionArgs but intent is pay
            console.log("No function args but intent is pay, extracting from text:", data.text);
            const amountMatch = data.text.match(/(\d+(\.\d+)?)\s*PYUSD/i);
            const recipientMatch = data.text.match(/@([a-zA-Z0-9_]+)/);
            
            if (amountMatch && recipientMatch) {
              validatedFunctionArgs = {
                recipient: recipientMatch[1],
                amount: amountMatch[1],
                description: `Payment to ${recipientMatch[1]}`
              };
              console.log("Extracted function args from text:", validatedFunctionArgs);
            }
          }
        } catch (error) {
          console.error("Error processing function args:", error);
        }
        
        console.log("Checking function name equality:", {
          exactMatch: data.functionName === "send_payment",
          trimmedMatch: data.functionName && data.functionName.trim() === "send_payment",
          lowercaseMatch: data.functionName && data.functionName.toLowerCase() === "send_payment",
          trimmedLowercaseMatch: data.functionName && data.functionName.trim().toLowerCase() === "send_payment",
          includes: data.functionName && data.functionName.includes("send_payment"),
          stringifiedIncludes: data.functionName && String(data.functionName).includes("send_payment")
        });
        
        // Create message actions array
        const actions: MessageAction[] = [];
        
        // HANDLE CREATE PAYMENT REQUEST - This is the critical part for the link issue
        if (data.functionName === "create_payment_request" || (data.requestId && data.intent === "request")) {
          console.log("📝 Adding payment request action button");
          console.log("Complete response data:", data);
          console.log("Request ID from response:", data.requestId);
          console.log("Intent from response:", data.intent);
          
          if (data.requestId) {
            console.log("📋 Request ID detected:", data.requestId);
            
            // Add the action for the request view
            const requestAction = createRequestViewAction(data.requestId);
            console.log("Created request action:", requestAction);
            actions.push(requestAction);
            console.log("Actions array after push:", actions);
          } else {
            console.log("⚠️ No requestId found in response, using fallback to list view");
            actions.push({
              label: "View Requests",
              href: `/request/list`,
              isPrimary: true,
              icon: <FileText className="w-4 h-4" />
            });
          }
        }
        // HANDLE SEND PAYMENT - Improved detection with comprehensive checks
        else if (
          // Check various ways the function name might be represented
          (data.functionName && (
            data.functionName === "send_payment" ||
            String(data.functionName).trim().toLowerCase() === "send_payment" ||
            String(data.functionName).trim().toLowerCase().includes("send_payment") ||
            String(data.functionName).trim().toLowerCase().includes("payment") && data.intent === "pay"
          )) ||
          // Also check intent as a fallback
          (data.intent === "pay" && (data.functionArgs || data.text.includes("PYUSD")))
        ) {
          console.log("💸 Adding send_payment action buttons");
          console.log("Function name exact comparison:", data.functionName === "send_payment");
          console.log("Function name normalized comparison:", String(data.functionName).trim().toLowerCase() === "send_payment");
          console.log("Function name includes comparison:", String(data.functionName).toLowerCase().includes("payment"));
          console.log("Using validated function args:", validatedFunctionArgs);
          
          const paymentAction = {
            label: "Confirm Payment",
            isPrimary: true,
            icon: <CreditCard className="w-4 h-4" />,
            onClick: () => {
              // ---> SIMPLIFIED: Just call executePayment which reads from ref
              console.log("🅿️ Confirm Payment button onClick triggered. Calling executePayment (ref version)...");
              executePayment(); 
            }
          };
          
          console.log("Created payment action:", paymentAction);
          actions.push(paymentAction);
          console.log("Actions array after push:", actions);
        }
        // HANDLE CHECK BALANCE
        else if (data.functionName === "check_balance") {
          console.log("💰 Adding balance action button");
          actions.push({
            label: "View Details",
            href: `/dashboard`,
            isPrimary: true,
            icon: <BarChart className="w-4 h-4" />
          });
        }
        
        // Add a force test action for debugging
        if (data.intent === 'pay' && actions.length === 0) {
          console.log("⚠️ No actions were added for payment intent. Adding DEBUG action as fallback");
          actions.push({
            label: "DEBUG: Force Payment",
            isPrimary: true,
            icon: <CreditCard className="w-4 h-4" />,
            onClick: () => {
              console.log("DEBUG: Force payment button clicked");
              alert("Debug payment action triggered. This would normally initiate a wallet transaction.");
            }
          });
        }
        
        console.log(`📝 Creating new assistant message with ${actions.length} actions`);
        console.log("Final actions array before message creation:", actions);
        
        // Create the new message object
        newMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.text || "I'm not sure how to respond to that.",
          timestamp: new Date(),
          actions: actions.length > 0 ? actions : undefined
        };
        
        console.log("📨 New message object created:", {
          id: newMessage.id,
          role: newMessage.role,
          contentSnippet: newMessage.content.substring(0, 50) + '...',
          timestamp: newMessage.timestamp,
          hasActions: !!newMessage.actions,
          actionsCount: newMessage.actions?.length || 0,
          actionsStringified: newMessage.actions ? JSON.stringify(newMessage.actions, (key, value) => typeof value === 'function' ? '[function]' : value) : 'undefined' 
        });

      } catch (procErr) {
        // ---> CATCH PROCESSING ERRORS
        console.error("❌ Error during assistant response processing:", procErr);
        processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
      }

      // ---> Check mount status immediately before potential state update
      console.log(`❓ Checking mount status before final state update: isMounted.current = ${isMounted.current}`);

      if (isMounted.current) {
        console.log("✅ Component is mounted. Proceeding to update final state.");
        if (processingError) {
          console.error("Processing failed. Setting error state.");
          setError(processingError.message);
          // Add error message directly
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Sorry, I encountered an error while processing the response: ${processingError.message}`,
              timestamp: new Date()
            }
          ]);
        } else if (newMessage) {
          // ---> CALL setMessages DIRECTLY
          console.log("✅ Processing successful. Calling setMessages directly with new assistant message.");
          setMessages(prevMessages => {
            console.log("🔄 Inside setMessages callback for assistant message.");
            return [...prevMessages, newMessage!]; 
          });
          console.log("✅ setMessages call completed for assistant message.");
        } else {
          console.warn("❓ No message created, and no processing error occurred. No state update needed.");
        }
      } else {
        console.warn("⚠️ Component unmounted just before final state update could occur. Discarding message/error.");
      }
    } catch (err) {
      // This catches errors from the fetch call itself or JSON parsing
      console.error("❌ Error during API fetch or JSON parsing:", err);
      
      // Ensure loading is set to false on error
      updateLoadingState(false);
      
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        
        // Add error message
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "I'm sorry, but I encountered an error communicating with the assistant. Please try again later.",
            timestamp: new Date()
          }
        ]);
      }
    }
  }, [address, updateLoadingState, createRequestViewAction, executePayment, setError]);

  const resetConversation = useCallback(() => {
    setMessages([{...WELCOME_MESSAGE, timestamp: new Date()}]);
    setError(null);
  }, []);

  // Return the current loading state from the ref instead of state for immediate response
  return {
    messages,
    isLoading: loadingRef.current, // Use the ref value directly for more responsive UI
    error,
    sendMessage,
    resetConversation
  };
}