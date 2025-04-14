import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistant } from '@/components/ai/use-assistant';
import { useAccount } from 'wagmi';
import React from 'react';

// Define types for mock useAccount return
type MockAccountReturn = {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
}

// Mock the useAccount hook
vi.mock('wagmi', () => ({
  useAccount: vi.fn()
}));

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Define a simple wrapper component to handle React 18 concurrent rendering
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('useAssistant Hook', () => {
  const mockAddress = '0x123456789abcdef123456789abcdef123456789';
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup default mock for useAccount with connectedState
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: mockAddress as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      status: 'connected'
    } as MockAccountReturn);
    
    // Setup default mock for fetch with successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: "I'll help you with that request.",
        intent: "general"
      })
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with a welcome message', () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].content).toContain('Hello!');
  });
  
  it('should not send a message if wallet is not connected', async () => {
    // Override the useAccount mock to return no address
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      status: 'disconnected'
    } as MockAccountReturn);
    
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    await act(async () => {
      await result.current.sendMessage('Hello assistant');
    });
    
    expect(result.current.error).toContain('connect your wallet');
    expect(mockFetch).not.toHaveBeenCalled();
  });
  
  it('should add user message and call fetch API when sending a message', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    const userMessage = 'Hello assistant';
    
    // Mock fetch to delay response
    mockFetch.mockImplementationOnce(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              text: "I'll help you with that request.",
              intent: "general"
            })
          });
        }, 50);
      });
    });
    
    // Send the message
    let sendPromise: Promise<void>;
    await act(() => {
      sendPromise = result.current.sendMessage(userMessage);
    });
    
    // Check that the user message is added immediately
    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[1].role).toBe('user');
    expect(result.current.messages[1].content).toBe(userMessage);
    
    // Wait for the API call to complete
    await act(async () => {
      await sendPromise;
    });
    
    // After completion, we should have the welcome message + user message + assistant response
    expect(result.current.messages.length).toBe(3);
    
    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/assistant',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${mockAddress}`
        }),
        body: JSON.stringify({ message: userMessage })
      })
    );
  });
  
  it('should add assistant response after successful API call', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    const userMessage = 'Hello assistant';
    const assistantResponse = "I'll help you with that request.";
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        text: assistantResponse,
        intent: "general"
      })
    });
    
    await act(async () => {
      await result.current.sendMessage(userMessage);
    });
    
    // After full completion we should have welcome + user message + assistant response
    expect(result.current.messages.length).toBe(3);
    expect(result.current.messages[1].role).toBe('user');
    expect(result.current.messages[1].content).toBe(userMessage);
    expect(result.current.messages[2].role).toBe('assistant');
    expect(result.current.messages[2].content).toBe(assistantResponse);
  });
  
  it('should handle API errors gracefully', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    // Mock a failed API call
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Server error'
      })
    });
    
    await act(async () => {
      await result.current.sendMessage('Trigger an error');
    });
    
    // Welcome + user message + error message
    expect(result.current.messages.length).toBe(3);
    expect(result.current.messages[2].role).toBe('assistant');
    expect(result.current.messages[2].content).toContain('sorry');
    expect(result.current.error).toBeDefined();
  });
  
  it('should add actions to assistant messages when provided', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    // Mock API response with payment function
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        text: "I'll send 10 PYUSD to user123.",
        intent: "pay",
        functionName: "send_payment",
        functionArgs: {
          recipient: "user123",
          amount: "10",
          description: "test payment"
        }
      })
    });
    
    await act(async () => {
      await result.current.sendMessage('Send 10 PYUSD to user123');
    });
    
    // Assistant message should have actions
    expect(result.current.messages[2].actions).toBeDefined();
    expect(result.current.messages[2].actions?.length).toBeGreaterThan(0);
    expect(result.current.messages[2].actions?.[0].label).toBe('Confirm Payment');
  });
  
  it('should reset the conversation', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    // Add a message first
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        text: "Hello back!",
        intent: "general"
      })
    });
    
    await act(async () => {
      await result.current.sendMessage('Hello');
    });
    
    // Should have more than just the welcome message
    expect(result.current.messages.length).toBeGreaterThan(1);
    
    // Reset the conversation
    act(() => {
      result.current.resetConversation();
    });
    
    // Should be back to just the welcome message
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].content).toContain('Hello!');
  });
  
  it('should update loading state during API calls', async () => {
    const { result } = renderHook(() => useAssistant(), {
      wrapper: TestWrapper
    });
    
    // Setup a delayed response
    let resolvePromise: (value: unknown) => void;
    const responsePromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    mockFetch.mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => responsePromise
      });
    });
    
    // Start sending a message without waiting for completion
    const sendPromise = result.current.sendMessage('Hello');
    
    // Loading state should be true during the fetch
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    
    // Resolve the API call
    await act(async () => {
      resolvePromise({
        text: "Hello back!",
        intent: "general"
      });
      await sendPromise;
    });
    
    // Loading state should be false after the API call
    expect(result.current.isLoading).toBe(false);
  });
}); 