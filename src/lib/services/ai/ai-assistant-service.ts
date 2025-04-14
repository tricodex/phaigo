import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { payAgent } from "./agents/pay/pay-agent";
import { requestAgent } from "./agents/request/request-agent";
import { analyticsAgent } from "./agents/analytics/analytics-agent";
import { singleton } from "@/lib/utils/singleton";
import { userService } from "../users/user-service";

export type AssistantIntent = "general" | "pay" | "request" | "analytics";

export interface AssistantResponse {
  text: string;
  intent?: AssistantIntent;
  functionName?: string;
  functionArgs?: unknown;
  requestId?: string;
  balanceData?: unknown;
  transactionData?: unknown[];
  requests?: unknown[];
}

const intentRecognitionFunctionDeclaration = {
  name: "recognize_intent",
  description: "Determines the user's intent from their message.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      intent: {
        type: Type.STRING,
        description: "The recognized intent",
        enum: ["general", "pay", "request", "analytics"]
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence level (0-1) in the intent recognition"
      },
      entities: {
        type: Type.OBJECT,
        description: "Extracted entities from the message",
        properties: {
          recipient: { 
            type: Type.STRING, 
            description: "Username of payment recipient if detected" 
          },
          amount: { 
            type: Type.STRING, 
            description: "Payment amount if detected" 
          },
          description: { 
            type: Type.STRING, 
            description: "Payment description if detected" 
          }
        }
      }
    },
    required: ["intent"]
  }
};

export class AIAssistantService {
  private apiKey: string;
  private genAI: GoogleGenAI;
  private systemInstruction: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Invalid API key: AIAssistantService requires a non-empty API key');
    }
    
    this.apiKey = apiKey.trim();
    this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
    
    // Define the system instruction for the AI assistant
    this.systemInstruction = `
      You are a friendly and helpful AI assistant for PYUSD, a stablecoin on the Ethereum blockchain. 
      You help users with:
      
      1. Sending PYUSD payments to other users
      2. Creating and managing payment requests
      3. Checking balances and transaction analytics
      4. General information about PYUSD and the platform
      
      When a user messages you, determine their intent and categorize it as:
      - "pay": User wants to send a payment
      - "request": User wants to create or manage payment requests
      - "analytics": User wants information about balances or transactions
      - "general": General questions or other interactions
      
      Based on the intent, you'll route the request to the appropriate specialized agent.
      
      Always be helpful, concise, and focused on addressing the user's needs efficiently.
    `;
  }

  // Recognize the user's intent from their message
  private async recognizeIntent(message: string): Promise<{
    intent: AssistantIntent;
    confidence: number;
    entities: {
      recipient?: string;
      amount?: string;
      description?: string;
    };
  }> {
    try {
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: message,
        config: {
          systemInstruction: this.systemInstruction,
          tools: [{
            functionDeclarations: [intentRecognitionFunctionDeclaration]
          }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY
            }
          }
        },
      });

      // Check if there's a function call in the response
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        
        if (functionCall.name === "recognize_intent") {
          const args = functionCall.args as {
            intent: AssistantIntent;
            confidence: number;
            entities: {
              recipient?: string;
              amount?: string;
              description?: string;
            };
          };
          
          return {
            intent: args.intent,
            confidence: args.confidence || 0.8,
            entities: args.entities || {}
          };
        }
      }
      
      // Default to general intent if no function call was made
      return {
        intent: "general",
        confidence: 0.5,
        entities: {}
      };
    } catch (error) {
      console.error("Error recognizing intent:", error);
      // Always return a valid intent object to avoid undefined intents
      return {
        intent: "general",
        confidence: 0.5,
        entities: {}
      };
    }
  }

  /**
   * Process a user message and determine the appropriate agent to handle it
   */
  async processMessage(
    message: string,
    walletAddress: string
  ): Promise<AssistantResponse> {
    try {
      console.log("AI assistant processing message:", message);
      
      // First, check if the message is a payment-related query
      if (message.toLowerCase().includes('pay') || 
          message.toLowerCase().includes('send') ||
          message.toLowerCase().includes('pyusd') ||
          message.toLowerCase().includes('payment')) {
        
        console.log("Detected payment intent, routing to pay agent");
        const payAgentInstance = payAgent(this.apiKey);
        const response = await payAgentInstance.processMessage(message, walletAddress);
        
        // Ensure consistent function name format
        if (response.functionName) {
          console.log("Original function name:", response.functionName);
          // Normalize function name to lowercase without spaces
          response.functionName = String(response.functionName).trim().toLowerCase();
          console.log("Normalized function name:", response.functionName);
        }
        
        // Cast the intent to the correct type
        return { ...response, intent: response.intent as AssistantIntent };
      }

      // If wallet address is missing, return helpful error message
      if (!walletAddress) {
        return { 
          text: "I couldn't verify your account. Please connect your wallet to use the assistant.",
          intent: "general"
        };
      }

      // Ensure user exists in the system
      const user = await userService.findOrCreateUser(walletAddress);
      if (!user) {
        console.error(`Failed to find or create user with wallet address ${walletAddress}`);
        return { 
          text: "I couldn't verify your account. Please try again later or contact support.",
          intent: "general"
        };
      }

      // Recognize intent from user message
      let intent: AssistantIntent = "general";
      
      try {
        const intentResult = await this.recognizeIntent(message);
        intent = intentResult.intent;
        // We don't directly use entities here as they're passed via the original message
        console.log(`Recognized intent: ${intent} for message: "${message.slice(0, 30)}..."`);
      } catch (intentRecognitionError) {
        console.error("Error recognizing intent:", intentRecognitionError);
        // Continue with general intent if intent recognition fails
        intent = "general";
      }
      
      // Route to the appropriate agent based on intent
      try {
        switch (intent) {
          case "pay": {
            const payAgentInstance = payAgent(this.apiKey);
            const response = await payAgentInstance.processMessage(message, walletAddress);
            return { ...response, intent };
          }
          
          case "request": {
            const requestAgentInstance = requestAgent(this.apiKey);
            const response = await requestAgentInstance.processMessage(message, walletAddress);
            return { ...response, intent };
          }
          
          case "analytics": {
            const analyticsAgentInstance = analyticsAgent(this.apiKey);
            const response = await analyticsAgentInstance.processMessage(message, walletAddress);
            return { ...response, intent };
          }
          
          case "general":
          default: {
            // For general intent, use the main AI model directly
            const response = await this.genAI.models.generateContent({
              model: "gemini-2.0-flash",
              contents: message,
              config: {
                systemInstruction: `
                  You are a helpful assistant for a PYUSD payment platform. 
                  Answer general questions about PYUSD, blockchain, and the payment system.
                  Keep responses friendly, helpful and concise.
                  PYUSD is a stablecoin issued by PayPal on the Ethereum blockchain.
                  If the user wants to send payments, check balances, or create requests, suggest they use specific commands.
                `
              },
            });
            
            return { 
              text: response.text || "I can help you with general information about PYUSD.",
              intent
            };
          }
        }
      } catch (agentError) {
        console.error(`Error in ${intent} agent:`, agentError);
        return {
          text: "I'm having trouble processing your request. Please try again later.",
          intent
        };
      }
    } catch (error) {
      console.error("Error processing AI message:", error);
      return {
        text: "I'm having trouble processing your request. Please try again later.",
        intent: "general"
      };
    }
  }
}

// Export singleton instance
export const aiAssistantService = (providedApiKey: string): AIAssistantService => {
  return singleton<AIAssistantService>("aiAssistantService", () => {
    // Constructor will throw if key is invalid
    try {
      return new AIAssistantService(providedApiKey);
    } catch (error) {
      // Convert any unexpected errors to a standard format
      const message = error instanceof Error 
        ? error.message 
        : 'Failed to initialize AI Assistant Service';
      throw new Error(message);
    }
  });
};
