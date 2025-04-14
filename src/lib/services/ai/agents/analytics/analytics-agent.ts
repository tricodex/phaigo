import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { singleton } from "@/lib/utils/singleton";
import { pyusdTokenService } from "@/lib/services/blockchain/pyusd-token";
import { userService } from "@/lib/services/users/user-service";
import type { Network } from "@/types/network";

// Define function declarations for the AI agent
const getBalanceFunctionDeclaration = {
  name: "get_balance",
  description: "Gets the PYUSD balance for a wallet address.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      network: {
        type: Type.STRING,
        description: "The network to use (mainnet or sepolia)",
        enum: ["mainnet", "sepolia"] 
      }
    },
    required: [],
  },
};

const getTransactionHistoryFunctionDeclaration = {
  name: "get_transaction_history",
  description: "Gets the transaction history for a wallet address.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      network: {
        type: Type.STRING,
        description: "The network to use (mainnet or sepolia)",
        enum: ["mainnet", "sepolia"]
      },
      limit: {
        type: Type.NUMBER,
        description: "Maximum number of transactions to return"
      }
    },
    required: [],
  },
};

// Define types for function arguments
interface GetBalanceArgs {
  network?: Network;
}

interface GetTransactionHistoryArgs {
  network?: Network;
  limit?: number;
}

// Define type for transaction data
interface TransactionData {
  from: string;
  to: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  isIncoming: boolean;
}

// Define type for the response
interface AnalyticsResponse {
  text: string;
  functionName?: string;
  functionArgs?: GetBalanceArgs | GetTransactionHistoryArgs;
  balanceData?: { balance: string; network: Network };
  transactionData?: TransactionData[];
}

// AnalyticsAgent class for handling PYUSD analytics
export class AnalyticsAgent {
  private apiKey: string;
  private genAI: GoogleGenAI;
  private systemInstruction: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Define the system instruction for the AI assistant
    this.systemInstruction = `
      You are a helpful assistant for PYUSD analytics. You can help users check their balance and transaction history.
      
      When a user asks about their PYUSD balance:
      1. Call the get_balance function
      2. Present the balance in a friendly, easy-to-understand format
      
      When a user asks about their transaction history:
      1. Call the get_transaction_history function
      2. Summarize the transaction history in a friendly, organized way

      Always be helpful and focused on providing useful analytics insights.
      Prefer the sepolia testnet as the default network unless the user specifically mentions mainnet.
    `;
  }

  // Process user messages and handle analytics requests
  async processMessage(
    message: string,
    walletAddress: string
  ): Promise<AnalyticsResponse> {
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
              getBalanceFunctionDeclaration,
              getTransactionHistoryFunctionDeclaration
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
        
        // Handle get balance function
        if (functionCall.name === "get_balance") {
          const args = functionCall.args as GetBalanceArgs;
          const network = args.network || "sepolia";
          
          // Get the user's PYUSD balance
          const balance = await pyusdTokenService.getFormattedBalance(walletAddress, network);
          
          return {
            text: response.text || `Your PYUSD balance on ${network} is ${balance} PYUSD.`,
            functionName: "get_balance",
            functionArgs: args,
            balanceData: { balance, network }
          };
        }
        
        // Handle get transaction history function
        else if (functionCall.name === "get_transaction_history") {
          const args = functionCall.args as GetTransactionHistoryArgs;
          const network = args.network || "sepolia";
          const limit = args.limit || 10;
          
          // Get the user's transaction history
          const transactions = await pyusdTokenService.getTransactionHistory(walletAddress, network);
          const limitedTransactions = transactions.slice(0, limit);
          
          // Format transactions for display
          const formattedTransactions: TransactionData[] = limitedTransactions.map(tx => ({
            from: tx.from,
            to: tx.to,
            amount: pyusdTokenService.formatPyusd(tx.amount),
            txHash: tx.txHash,
            blockNumber: tx.blockNumber,
            isIncoming: tx.to.toLowerCase() === walletAddress.toLowerCase()
          }));
          
          return {
            text: response.text || `Here are your ${formattedTransactions.length} most recent PYUSD transactions on ${network}.`,
            functionName: "get_transaction_history",
            functionArgs: args,
            transactionData: formattedTransactions
          };
        }
      }

      // If no function call, just return the text response
      return { text: response.text || "I understand your request, but I'm not sure how to help with that specifically." };
    } catch (error) {
      console.error("Error processing AI analytics message:", error);
      return {
        text: "I'm having trouble retrieving your analytics data. Please try again later."
      };
    }
  }
}

// Export singleton instance
export const analyticsAgent = (apiKey: string) => 
  singleton<AnalyticsAgent>("analyticsAgent", () => {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required for Analytics Agent');
    }
    try {
      return new AnalyticsAgent(apiKey);
    } catch (error) {
      console.error('Failed to initialize Analytics Agent:', error);
      throw new Error('Failed to initialize Analytics Agent');
    }
  });
