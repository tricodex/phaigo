import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { singleton } from "@/lib/utils/singleton";
import { paymentService } from "@/lib/services/payments/payment-service";
import { userService } from "@/lib/services/users/user-service";

// Define function declarations for the AI agent
const listPaymentRequestsFunctionDeclaration = {
  name: "list_payment_requests",
  description: "Lists payment requests for the current user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.NUMBER,
        description: "Maximum number of requests to return", 
      },
    },
    required: [],
  },
};

const cancelPaymentRequestFunctionDeclaration = {
  name: "cancel_payment_request",
  description: "Cancels a pending payment request.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      requestId: {
        type: Type.STRING,
        description: "ID of the payment request to cancel",
      },
    },
    required: ["requestId"],
  },
};

const createPaymentRequestFunctionDeclaration = {
  name: "create_payment_request",
  description: "Creates a payment request for PYUSD.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: {
        type: Type.STRING,
        description: "Amount of PYUSD to request (e.g., '10', '5.5')",
      },
      description: {
        type: Type.STRING,
        description: "Optional description or notes for the payment request",
      },
      expiresIn: {
        type: Type.NUMBER,
        description: "Optional number of days until the request expires",
      },
    },
    required: ["amount"],
  },
};

// Define types for function arguments
interface ListPaymentRequestsArgs {
  limit?: number;
}

interface CancelPaymentRequestArgs {
  requestId: string;
}

interface CreatePaymentRequestArgs {
  amount: string;
  description?: string;
  expiresIn?: number;
}

// Define type for the request response
interface RequestResponse {
  text: string;
  functionName?: string;
  functionArgs?: ListPaymentRequestsArgs | CancelPaymentRequestArgs | CreatePaymentRequestArgs;
  requests?: PaymentRequest[];
  requestId?: string;
}

// Define payment request type
interface PaymentRequest {
  id: string;
  amount: string;
  description?: string;
  status: string;
  createdAt: Date;
  expiresAt?: Date | null;
  updatedAt?: Date;
  notes?: string | null;
  userId?: string;
  paymentId?: string | null;
  [key: string]: unknown;
}

// RequestAgent class for handling PYUSD payment request interactions
export class RequestAgent {
  private apiKey: string;
  private genAI: GoogleGenAI;
  private systemInstruction: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Define the system instruction for the AI assistant
    this.systemInstruction = `
      You are a helpful assistant for managing PYUSD payment requests. You can help users view, create, and cancel payment requests.
      
      When a user asks about their payment requests:
      1. Call the list_payment_requests function
      2. Summarize the results in a friendly, organized way
      
      When a user asks to create a payment request:
      1. Extract the amount, optional description, and optional expiration
      2. Call the create_payment_request function with this information
      3. Provide friendly confirmation to the user
      
      When a user asks to cancel a payment request:
      1. Extract the request ID or ask for it if not provided
      2. Call the cancel_payment_request function with this information
      3. Provide friendly confirmation to the user
      
      Always be helpful and focused on the user's payment request needs.
    `;
  }

  // Process user messages and handle payment request operations
  async processMessage(
    message: string,
    walletAddress: string
  ): Promise<RequestResponse> {
    try {
      // Ensure user exists in the system
      const user = await userService.findOrCreateUser(walletAddress);
      if (!user) {
        return { 
          text: "I couldn't verify your account. Please try again later or contact support." 
        };
      }

      // Call the AI model to interpret the user's message
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: message,
        config: {
          systemInstruction: this.systemInstruction,
          tools: [{
            functionDeclarations: [
              listPaymentRequestsFunctionDeclaration,
              cancelPaymentRequestFunctionDeclaration,
              createPaymentRequestFunctionDeclaration
            ]
          }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY  // Force function calling
            }
          }
        },
      });

      // Check if the response includes a function call
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        
        // Handle list payment requests function
        if (functionCall.name === "list_payment_requests") {
          const args = functionCall.args as unknown as ListPaymentRequestsArgs;
          const limit = args.limit || 10;
          
          // Get the user's payment requests
          const requests = await userService.getUserRequests(user.id);
          const limitedRequests = requests.slice(0, limit);
          
          return {
            text: response.text || `Here are your ${limitedRequests.length} most recent payment requests.`,
            functionName: "list_payment_requests",
            functionArgs: args,
            requests: limitedRequests
          };
        }
        
        // Handle cancel payment request function
        else if (functionCall.name === "cancel_payment_request") {
          const args = functionCall.args as unknown as CancelPaymentRequestArgs;
          
          // Try to cancel the payment request
          try {
            // Cancel the payment request but don't store the result
            await paymentService.cancelPaymentRequest(args.requestId, user.id);
            
            return {
              text: response.text || `I've canceled your payment request.`,
              functionName: "cancel_payment_request",
              functionArgs: args
            };
          } catch (error) {
            // Handle errors during cancellation
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            return {
              text: `I couldn't cancel that payment request: ${errorMessage}. Please try again later.`,
              functionName: "cancel_payment_request",
              functionArgs: args
            };
          }
        }

        // Handle create payment request function
        else if (functionCall.name === "create_payment_request") {
          const args = functionCall.args as unknown as CreatePaymentRequestArgs;
          
          // Create the payment request
          let expiresAt: Date | undefined = undefined;
          if (args.expiresIn) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + args.expiresIn);
          }
          
          try {
            const request = await paymentService.createPaymentRequest(
              user.id,
              args.amount,
              args.description,
              expiresAt
            );

            return {
              text: response.text || `I've created a payment request for ${args.amount} PYUSD${args.description ? ` with description: "${args.description}"` : ""}.`,
              functionName: "create_payment_request",
              functionArgs: args,
              requestId: request.id
            };
          } catch (error) {
            // Handle errors during request creation
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            return {
              text: `I couldn't create that payment request: ${errorMessage}. Please try again later.`,
              functionName: "create_payment_request",
              functionArgs: args
            };
          }
        }
      }

      // If no function call, just return the text response
      return { text: response.text || "I understand your request, but I'm not sure how to help with that specifically." };
    } catch (error) {
      console.error("Error processing AI payment request message:", error);
      return {
        text: "I'm having trouble processing your request. Please try again or try phrasing your request differently."
      };
    }
  }
}

// Export singleton instance
export const requestAgent = (apiKey: string) => 
  singleton<RequestAgent>("requestAgent", () => {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required for Request Agent');
    }
    try {
      return new RequestAgent(apiKey);
    } catch (error) {
      console.error('Failed to initialize Request Agent:', error);
      throw new Error('Failed to initialize Request Agent');
    }
  });
