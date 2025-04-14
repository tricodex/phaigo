import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { serverEnv } from '@/lib/config/server-env';

// Using a simpler approach to mocking
const mockProcessMessage = vi.fn();
const mockAIAssistantService = {
  processMessage: mockProcessMessage,
};

// Mock for the aiAssistantService
vi.mock('@/lib/services/ai/ai-assistant-service', () => ({
  aiAssistantService: vi.fn(() => mockAIAssistantService)
}));

// Mock for serverEnv
vi.mock('@/lib/config/server-env', () => ({
  serverEnv: {
    GEMINI_API_KEY: 'mock-api-key'
  }
}));

// Import the route handlers after mocking dependencies
import { POST as assistantPost, OPTIONS as assistantOptions } from '@/app/api/ai/assistant/route';
// Import debug routes
import { GET as debugGet, POST as debugPost } from '@/app/api/ai/assistant/debug/route';

describe('AI Assistant API Routes', () => {
  let mockRequest: NextRequest;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create a mock request
    mockRequest = {
      json: vi.fn().mockResolvedValue({ message: 'Hello from test' }),
      headers: new Headers({
        'Authorization': 'Wallet 0x123456789abcdef123456789abcdef123456789',
        'Content-Type': 'application/json'
      }),
      nextUrl: {
        searchParams: new URLSearchParams()
      }
    } as unknown as NextRequest;
    
    // Setup default mock response
    mockProcessMessage.mockResolvedValue({
      text: "I'll help you with that!",
      intent: "general"
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Assistant POST Handler', () => {
    it('should return a 500 error if GEMINI_API_KEY is not configured', async () => {
      // Temporarily mock serverEnv to have no API key
      vi.mocked(serverEnv).GEMINI_API_KEY = '';
      
      const response = await assistantPost(mockRequest);
      const responseJson = await response.json();
      
      expect(response.status).toBe(500);
      expect(responseJson.error).toContain('not configured');
      
      // Restore the mock
      vi.mocked(serverEnv).GEMINI_API_KEY = 'mock-api-key';
    });
    
    it('should return a 400 error if the request is missing a message', async () => {
      // Mock an invalid request
      mockRequest.json = vi.fn().mockResolvedValue({});
      
      const response = await assistantPost(mockRequest);
      const responseJson = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseJson.error).toContain('Invalid request');
    });
    
    it('should return a 401 error if Authorization header is missing', async () => {
      // Create a new headers object without the Authorization header
      const headersWithoutAuth = new Headers({
        'Content-Type': 'application/json'
      });
      
      // Create a new mock request with the updated headers
      const requestWithoutAuth = {
        ...mockRequest,
        headers: headersWithoutAuth
      } as unknown as NextRequest;
      
      const response = await assistantPost(requestWithoutAuth);
      const responseJson = await response.json();
      
      expect(response.status).toBe(401);
      expect(responseJson.error).toContain('Authorization required');
    });
    
    it('should process the message and return a successful response', async () => {
      const response = await assistantPost(mockRequest);
      const responseJson = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseJson.text).toBe("I'll help you with that!");
      expect(responseJson.intent).toBe("general");
      
      // Verify the assistant service was called with correct parameters
      expect(mockProcessMessage).toHaveBeenCalledWith(
        'Hello from test',
        '0x123456789abcdef123456789abcdef123456789'
      );
    });
    
    it('should handle errors from the assistant service', async () => {
      // Mock the assistant service to throw an error
      mockProcessMessage.mockRejectedValueOnce(new Error('Test error'));
      
      const response = await assistantPost(mockRequest);
      const responseJson = await response.json();
      
      expect(response.status).toBe(500);
      expect(responseJson.error).toContain('Failed to process');
    });
  });
  
  describe('Assistant OPTIONS Handler', () => {
    it('should return CORS headers', async () => {
      const response = await assistantOptions();
      
      expect(response.status).toBe(200);
      
      // Check for CORS headers using getters
      const corsHeaders = response.headers;
      expect(corsHeaders.get('access-control-allow-origin')).toBe('*');
      expect(corsHeaders.get('access-control-allow-methods')).toContain('OPTIONS');
      expect(corsHeaders.get('access-control-allow-headers')).toContain('Content-Type');
      expect(corsHeaders.get('access-control-allow-headers')).toContain('Authorization');
    });
  });
  
  describe('Debug Routes', () => {
    it('should return API configuration information', async () => {
      // Use vi.stubEnv instead of directly modifying process.env
      vi.stubEnv('NODE_ENV', 'development');
      
      const response = await debugGet();
      const responseJson = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseJson.geminiApiKey.exists).toBe(true);
      expect(responseJson.environment).toBe('development');
      
      // Restore the environment
      vi.unstubAllEnvs();
    });
    
    it('should block debug endpoints in production', async () => {
      // Use vi.stubEnv for environment mocking
      vi.stubEnv('NODE_ENV', 'production');
      
      const getResponse = await debugGet();
      expect(getResponse.status).toBe(403);
      
      const postResponse = await debugPost(mockRequest);
      expect(postResponse.status).toBe(403);
      
      // Restore the environment
      vi.unstubAllEnvs();
    });
    
    it('should process test messages in debug mode', async () => {
      // Use vi.stubEnv for environment mocking
      vi.stubEnv('NODE_ENV', 'development');
      
      // Setup the mock request for debug endpoint
      mockRequest.json = vi.fn().mockResolvedValue({
        message: 'Debug test message',
        walletAddress: '0xdebug123'
      });
      
      // Setup specific response for this test
      mockProcessMessage.mockResolvedValueOnce({
        text: "Debug response",
        intent: "general",
        debug: true
      });
      
      const response = await debugPost(mockRequest);
      const responseJson = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseJson.success).toBe(true);
      expect(responseJson.result).toEqual({
        text: "Debug response",
        intent: "general",
        debug: true
      });
      
      // Check that the correct wallet address was used
      expect(mockProcessMessage).toHaveBeenCalledWith(
        'Debug test message',
        '0xdebug123'
      );
      
      // Restore the environment
      vi.unstubAllEnvs();
    });
  });
}); 