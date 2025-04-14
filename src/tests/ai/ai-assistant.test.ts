import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiAssistantService } from '@/lib/services/ai/ai-assistant-service';
import { GoogleGenAI } from '@google/genai';
import { payAgent } from '@/lib/services/ai/agents/pay/pay-agent';
import { userService } from '@/lib/services/users/user-service';
import type { PayAgent } from '@/lib/services/ai/agents/pay/pay-agent';
import { requestAgent } from '@/lib/services/ai/agents/request/request-agent';
import { analyticsAgent } from '@/lib/services/ai/agents/analytics/analytics-agent';

// Define type for mocked user
type MockUser = {
  id: string;
  username: string;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
  displayName: string | null;
  profileImage: string | null;
  email: string | null;
  bio: string | null;
};

// Define a mock for GoogleGenAI models
interface MockGenAIModel {
  generateContent: ReturnType<typeof vi.fn>;
  generateContentStream: ReturnType<typeof vi.fn>;
  generateImages: ReturnType<typeof vi.fn>;
  generateContentInternal: ReturnType<typeof vi.fn>;
  batchGenerateContent: ReturnType<typeof vi.fn>;
  countTokens: ReturnType<typeof vi.fn>;
  embedContent: ReturnType<typeof vi.fn>;
  embedContentStream: ReturnType<typeof vi.fn>;
  startConversation: ReturnType<typeof vi.fn>;
  startTool: ReturnType<typeof vi.fn>;
  startToolStream: ReturnType<typeof vi.fn>;
  apiClient: Record<string, unknown>;
}

// We'll use a partial implementation since we can't access private properties
type MockAgentType = Omit<PayAgent, 'apiKey'> & {
  processMessage: ReturnType<typeof vi.fn>;
};

// Mock Google GenAI
vi.mock('@google/genai', async () => {
  const actual = await vi.importActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(() => {
      // Create a mock that matches the expected interface
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: "This is a mock response from Gemini AI",
        functionCalls: [{
          name: "recognize_intent",
          args: {
            intent: "pay",
            confidence: 0.9,
            entities: {
              recipient: "user123",
              amount: "10",
              description: "test payment"
            }
          }
        }]
      });
      
      return {
        models: (name?: string): MockGenAIModel => ({
          generateContent: mockGenerateContent,
          generateContentStream: vi.fn(),
          generateImages: vi.fn(),
          generateContentInternal: vi.fn(),
          batchGenerateContent: vi.fn(),
          countTokens: vi.fn(),
          embedContent: vi.fn(),
          embedContentStream: vi.fn(),
          startConversation: vi.fn(),
          startTool: vi.fn(),
          startToolStream: vi.fn(),
          apiClient: {}
        })
      };
    })
  };
});

// Mock pay agent
vi.mock('@/lib/services/ai/agents/pay/pay-agent', () => ({
  payAgent: vi.fn().mockImplementation((): MockAgentType => ({
    processMessage: vi.fn().mockResolvedValue({
      text: "I'll help you send a payment",
      functionName: "send_payment",
      functionArgs: {
        recipient: "user123",
        amount: "10"
      }
    })
  }))
}));

// Mock user service
vi.mock('@/lib/services/users/user-service', () => ({
  userService: {
    getUserByUsername: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      username: 'testuser',
      walletAddress: '0x123456789abcdef',
      createdAt: new Date(),
      updatedAt: new Date(),
      displayName: 'Test User',
      profileImage: null,
      email: null,
      bio: null
    })
  }
}));

// Mock request agent
vi.mock('@/lib/services/ai/agents/request/request-agent', () => ({
  requestAgent: vi.fn().mockImplementation((): MockAgentType => ({
    processMessage: vi.fn().mockResolvedValue({
      text: "I'll help you create a request"
    })
  }))
}));

// Mock analytics agent
vi.mock('@/lib/services/ai/agents/analytics/analytics-agent', () => ({
  analyticsAgent: vi.fn().mockImplementation((): MockAgentType => ({
    processMessage: vi.fn().mockResolvedValue({
      text: "I'll help you with analytics"
    })
  }))
}));

describe('AI Assistant Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize properly', () => {
    expect(aiAssistantService).toBeDefined();
  });

  it('should process a message with pay intent', async () => {
    const message = "Send 10 PYUSD to user123";
    const walletAddress = "0x123456789abcdef";

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(response).toHaveProperty('functionName');
    expect(response).toHaveProperty('functionArgs');
    expect(payAgent).toHaveBeenCalled();
  });

  it('should process a message with request intent', async () => {
    const message = "Request 20 PYUSD from user123 for lunch";
    const walletAddress = "0x123456789abcdef";
    
    // Mock the Google GenAI intent recognition for request
    const mockGenAI = new GoogleGenAI("mock-api-key");
    const mockModel = mockGenAI.models();
    mockModel.generateContent.mockResolvedValueOnce({
      text: "This is a mock response from Gemini AI",
      functionCalls: [{
        name: "recognize_intent",
        args: {
          intent: "request",
          confidence: 0.9,
          entities: {
            recipient: "user123",
            amount: "20",
            description: "lunch"
          }
        }
      }]
    });

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(requestAgent).toHaveBeenCalled();
  });

  it('should process a message with analytics intent', async () => {
    const message = "What's my current balance?";
    const walletAddress = "0x123456789abcdef";
    
    // Mock the Google GenAI intent recognition for analytics
    const mockGenAI = new GoogleGenAI("mock-api-key");
    const mockModel = mockGenAI.models();
    mockModel.generateContent.mockResolvedValueOnce({
      text: "This is a mock response from Gemini AI",
      functionCalls: [{
        name: "recognize_intent",
        args: {
          intent: "analytics",
          confidence: 0.9,
          entities: {}
        }
      }]
    });

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(analyticsAgent).toHaveBeenCalled();
  });

  it('should handle unknown intent', async () => {
    const message = "What's the weather like today?";
    const walletAddress = "0x123456789abcdef";
    
    // Mock the Google GenAI intent recognition for unknown intent
    const mockGenAI = new GoogleGenAI("mock-api-key");
    const mockModel = mockGenAI.models();
    mockModel.generateContent.mockResolvedValueOnce({
      text: "This is a mock response from Gemini AI",
      functionCalls: [{
        name: "recognize_intent",
        args: {
          intent: "unknown",
          confidence: 0.9,
          entities: {}
        }
      }]
    });

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(response.text).toContain("I can help you with");
  });

  it('should handle missing intent data', async () => {
    const message = "Hello there";
    const walletAddress = "0x123456789abcdef";
    
    // Mock the Google GenAI response without intent recognition
    const mockGenAI = new GoogleGenAI("mock-api-key");
    const mockModel = mockGenAI.models();
    mockModel.generateContent.mockResolvedValueOnce({
      text: "This is a mock response from Gemini AI"
      // No functionCalls property
    });

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(response.text).toContain("I can help you with");
  });

  it('should handle API errors gracefully', async () => {
    const message = "Send 10 PYUSD to user123";
    const walletAddress = "0x123456789abcdef";
    
    // Mock the Google GenAI to throw an error
    const mockGenAI = new GoogleGenAI("mock-api-key");
    const mockModel = mockGenAI.models();
    mockModel.generateContent.mockRejectedValueOnce(new Error("API Error"));

    const response = await aiAssistantService.processMessage(message, walletAddress);

    expect(response).toHaveProperty('text');
    expect(response.text).toContain("I'm having trouble processing");
  });
}); 