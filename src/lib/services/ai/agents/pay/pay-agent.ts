import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { singleton } from "@/lib/utils/singleton";
import { paymentService } from "@/lib/services/payments/payment-service";
import { userService } from "@/lib/services/users/user-service";

// Define function declarations for the AI agent
const sendPaymentFunctionDeclaration = {
  name: "send_payment",
  description: "Sends a PYUSD payment to a recipient.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      recipient: {
        type: Type.STRING,
        description: "Username of the payment recipient", 
      },
      amount: {
        type: Type.STRING,
        description: "Amount of PYUSD to send (e.g., '10', '5.5')",
      },
      description: {
        type: Type.STRING,
        description: "Optional description or notes for the payment",
      },
    },
    required: ["recipient", "amount"],
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
interface SendPaymentArgs {
  recipient: string;
  amount: string;
  description?: string;
}

interface CreatePaymentRequestArgs {
  amount: string;
  description?: string;
  expiresIn?: number;
}

// Define type for the payment response
interface PayResponse {
  text: string;
  functionName?: string;
  functionArgs?: SendPaymentArgs | CreatePaymentRequestArgs;
  requestId?: string;
  intent?: string;
}

// PayAgent class for handling PYUSD payment interactions
export class PayAgent {
  private apiKey: string;
  private genAI: GoogleGenAI;
  private systemInstruction: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Define the system instruction for the AI assistant
    this.systemInstruction = `
      You are a helpful assistant for PYUSD payments. You can help users send payments and create payment requests.
      
      When a user asks to send a payment:
      1. Extract the recipient's username, amount, and optional description
      2. Call the send_payment function with this information
      3. Provide friendly confirmation to the user
      
      When a user asks to create a payment request:
      1. Extract the amount, optional description, and optional expiration
      2. Call the create_payment_request function with this information
      3. Provide friendly confirmation to the user

      Always be helpful, concise, and focused on the user's payment needs.
      
      Important note: DO NOT actually execute any blockchain transactions directly. The payment functions 
      only prepare the transaction for the user to sign themselves later.
    `;
  }

  // Process user messages and handle payment intent detection
  async processMessage(
    message: string,
    walletAddress: string
  ): Promise<PayResponse> {
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
              sendPaymentFunctionDeclaration,
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
        
        // Handle send payment function
        if (functionCall.name === "send_payment") {
          const args = functionCall.args as unknown as SendPaymentArgs;
          
          // Normalize username by removing @ symbol if present
          const normalizedUsername = args.recipient.replace(/^@/, '');
          console.log(`Pay agent: Normalized username from "${args.recipient}" to "${normalizedUsername}"`);
          
          // Validate the recipient exists
          const recipientUser = await userService.getUserByUsername(normalizedUsername);
          if (!recipientUser) {
            console.log(`Pay agent: User "${normalizedUsername}" not found in database`);
            return {
              text: `I couldn't find a user with the username "${args.recipient}". Please check the username and try again.`,
              intent: 'pay'
            };
          }
          
          console.log(`Pay agent: Found user "${normalizedUsername}" with ID ${recipientUser.id}`);
          
          return {
            text: response.text || `I'll prepare a payment of ${args.amount} PYUSD to @${normalizedUsername}. Please review and confirm the transaction.`,
            functionName: "send_payment",
            functionArgs: {
              ...args,
              recipient: normalizedUsername // Use normalized username for the rest of the flow
            },
            intent: 'pay'
          };
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
            requestId: request.id,
            intent: "request"
          };
        }
      }

      // If no function call, just return the text response
      return { text: response.text || "I understand your request, but I'm not sure how to help with that specifically." };
    } catch (error) {
      console.error("Error processing AI payment message:", error);
      return {
        text: "I'm having trouble processing your request. Please try again or try phrasing your request differently."
      };
    }
  }
}

// Export singleton instance
export const payAgent = (apiKey: string) => 
  singleton<PayAgent>("payAgent", () => {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required for Pay Agent');
    }
    try {
      return new PayAgent(apiKey);
    } catch (error) {
      console.error('Failed to initialize Pay Agent:', error);
      throw new Error('Failed to initialize Pay Agent');
    }
  });
