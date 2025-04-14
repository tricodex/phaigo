'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Network } from '@/types/network';
import { Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { pyusdTokenService } from '@/lib/services/blockchain/pyusd-token';
import { ethers } from 'ethers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PyusdIcon from '@/components/ui/pyusd-icon';

interface SendPaymentFormProps {
  senderAddress?: string;
  network: Network;
  onSuccess?: () => void;
  initialRecipient?: string;
}

// Utility function to validate and normalize an Ethereum address
const normalizeAddress = (address: string): string | null => {
  try {
    // Check if the address has the correct format
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      console.error('Invalid address format:', address);
      return null;
    }
    
    // Attempt to convert to checksum address (will throw if invalid)
    const normalized = ethers.getAddress(address);
    return normalized;
  } catch (error) {
    console.error('Error normalizing address:', error);
    return null;
  }
};

// Add this constant at the top of the file
const NOTES_MAX_LENGTH = 200;

const SendPaymentForm = ({ 
  senderAddress, 
  network, 
  onSuccess,
  initialRecipient = ''
}: SendPaymentFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    recipient: initialRecipient,
    amount: '',
    notes: ''
  });
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [validating, setValidating] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<{
    displayName: string;
    username: string;
    walletAddress: string;
  } | null>(null);

  // Fetch the user's balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!senderAddress) return;
      
      try {
        const formattedBalance = await pyusdTokenService.getFormattedBalance(senderAddress, network);
        setBalance(formattedBalance);
      } catch (error) {
        console.error('Error fetching PYUSD balance:', error);
      }
    };

    fetchBalance();
  }, [senderAddress, network]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // For amount, only allow numbers and one decimal point
    if (name === 'amount') {
      // Prevent more than one decimal point
      if (value.split('.').length > 2) return;
      
      // Ensure it's a valid number
      if (value && !/^\d*\.?\d*$/.test(value)) return;
      
      // Limit to 6 decimal places (PYUSD precision)
      const parts = value.split('.');
      if (parts[1] && parts[1].length > 6) return;
    }
    
    // Enforce character limit for notes
    if (name === 'notes' && value.length > NOTES_MAX_LENGTH) {
      return;
    }
    
    if (name === 'recipient') {
      // Clear previous validation when user starts typing
      setRecipientInfo(null);
      setRecipientError('');
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate recipient username and fetch wallet address
  const validateRecipient = async () => {
    if (!formData.recipient.trim()) {
      setRecipientError('Please enter a recipient username');
      return false;
    }
    
    try {
      setValidating(true);
      const response = await fetch(`/api/users/${formData.recipient.trim()}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.user) {
          setRecipientError('Recipient not found. Please check the username.');
          return false;
        }
        
        // Log the user object to see what's coming back from the API
        console.log('Recipient data from API:', data.user);
        
        // Check if wallet address is missing
        if (!data.user.walletAddress) {
          console.error('API response missing wallet address for user:', data.user.username);
          setRecipientError('Recipient wallet address not found in the system.');
          return false;
        }
        
        // Set the recipient info with the wallet address
        const normalizedAddress = normalizeAddress(data.user.walletAddress);
        if (!normalizedAddress) {
          console.error('Invalid wallet address format from API:', data.user.walletAddress);
          setRecipientError('Recipient has an invalid wallet address format.');
          return false;
        }
        
        setRecipientInfo({
          displayName: data.user.displayName || data.user.username,
          username: data.user.username,
          walletAddress: normalizedAddress
        });
        
        console.log('Set recipient info:', {
          displayName: data.user.displayName || data.user.username,
          username: data.user.username,
          walletAddress: normalizedAddress
        });
        
        return true;
      } else {
        setRecipientError('Recipient not found. Please check the username.');
        return false;
      }
    } catch (error) {
      console.error('Error validating recipient:', error);
      setRecipientError('Error validating recipient. Please try again.');
      return false;
    } finally {
      setValidating(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    console.log('handleSubmit function called');
    try {
      console.log('Form submission started', { formData });
      e.preventDefault();
      
      if (!senderAddress) {
        console.error('No sender address available');
        toast({
          title: 'Error',
          description: 'Wallet not connected. Please connect your wallet to send payments.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Sender address validated', { senderAddress });
      
      // Validate amount
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        console.error('Invalid amount', { amount: formData.amount });
        toast({
          title: 'Invalid Amount',
          description: 'Please enter a valid amount greater than 0',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Amount validated', { amount: formData.amount });
      
      // Validate recipient if not already validated
      if (!recipientInfo) {
        console.log('Validating recipient', { recipient: formData.recipient });
        const isValid = await validateRecipient();
        if (!isValid) {
          console.error('Recipient validation failed');
          return;
        }
      }
      
      console.log('Recipient validated', { recipientInfo });
      
      // Ensure wallet is properly connected before proceeding
      if (typeof window !== 'undefined' && window.ethereum) {
        console.log('Ensuring wallet connection before checking balance');
        try {
          // This will prompt the wallet if not already connected
          await window.ethereum.request({ method: 'eth_requestAccounts' });
        } catch (walletError) {
          console.error('Error connecting to wallet:', walletError);
          toast({
            title: 'Wallet Connection Failed',
            description: 'Please ensure your wallet is unlocked and try again',
            variant: 'destructive',
          });
          return;
        }
      }
      
      // Check balance
      try {
        console.log('Checking balance', { senderAddress, network });
        const userBalance = await pyusdTokenService.getBalance(senderAddress, network);
        const amountToSend = pyusdTokenService.parsePyusd(formData.amount, network);
        
        console.log('Balance check result', { 
          userBalance: userBalance.toString(), 
          amountToSend: amountToSend.toString(),
          hasEnough: userBalance >= amountToSend
        });
        
        if (userBalance < amountToSend) {
          toast({
            title: 'Insufficient Balance',
            description: 'You do not have enough PYUSD to complete this transaction',
            variant: 'destructive',
          });
          return;
        }
        
        console.log('About to send payment');
        // Proceed with payment
        await sendPayment();
      } catch (error) {
        console.error('Error checking balance:', error);
        toast({
          title: 'Error',
          description: 'Failed to verify your balance. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error handling form submission:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  // Send the payment
  const sendPayment = async () => {
    console.log('Starting sendPayment function');
    if (!recipientInfo || !senderAddress) {
      console.error('Missing recipient or sender info', { recipientInfo, senderAddress });
      toast({
        title: 'Error',
        description: 'Missing recipient or sender information',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate the recipient's wallet address
    if (!recipientInfo.walletAddress) {
      console.error('Recipient wallet address is missing');
      
      // Try to fetch the wallet address again as a fallback
      try {
        const response = await fetch(`/api/users/${recipientInfo.username}`);
        if (response.ok) {
          const data = await response.json();
          if (data.user && data.user.walletAddress) {
            // Normalize and validate the wallet address
            const normalizedAddress = normalizeAddress(data.user.walletAddress);
            if (!normalizedAddress) {
              console.error('Invalid wallet address format in fallback:', data.user.walletAddress);
              toast({
                title: 'Error',
                description: 'Recipient has an invalid wallet address format',
                variant: 'destructive',
              });
              return;
            }
            
            // Update recipientInfo with the normalized wallet address
            recipientInfo.walletAddress = normalizedAddress;
            console.log('Retrieved and normalized wallet address on second attempt:', normalizedAddress);
          } else {
            toast({
              title: 'Error',
              description: 'Recipient wallet address is missing or invalid',
              variant: 'destructive',
            });
            return;
          }
        } else {
          toast({
            title: 'Error',
            description: 'Recipient wallet address is missing or invalid',
            variant: 'destructive',
          });
          return;
        }
      } catch (error) {
        console.error('Error fetching recipient wallet address:', error);
        toast({
          title: 'Error',
          description: 'Failed to retrieve recipient wallet address',
          variant: 'destructive',
        });
        return;
      }
    }
    
    try {
      setLoading(true);
      console.log('Creating pending payment record in database with recipient address:', recipientInfo.walletAddress);
      
      // Step 1: Create pending payment record in the database (without transaction hash)
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${senderAddress}`,
        },
        body: JSON.stringify({
          recipientUsername: recipientInfo.username,
          amount: formData.amount,
          notes: formData.notes,
        }),
      });
      
      const responseData = await response.json();
      console.log('Database payment record created', responseData);
      
      if (!response.ok) {
        console.error('Payment initiation failed', responseData);
        throw new Error(responseData.error || 'Failed to initiate payment');
      }
      
      toast({
        title: 'Payment Initiated',
        description: `You're sending ${formData.amount} PYUSD to @${recipientInfo.username}`,
      });
      
      // Step 2: Execute blockchain transaction
      if (!window.ethereum) {
        console.error('No Ethereum provider found');
        throw new Error('No Ethereum provider found. Please install a wallet like MetaMask.');
      }
      
      console.log('Requesting Ethereum accounts to open wallet');
      // This will trigger the wallet popup for user confirmation
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      console.log('Creating Ethereum provider and getting signer');
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      try {
        const signer = await provider.getSigner();
        console.log('Got signer', { signerAddress: await signer.getAddress() });
        
        console.log('Executing transfer', {
          to: recipientInfo.walletAddress,
          amount: formData.amount,
          network
        });
        
        // Execute the actual blockchain transaction
        const tx = await pyusdTokenService.transfer(
          recipientInfo.walletAddress,
          formData.amount,
          signer,
          network
        );
        
        console.log('Transaction sent', { hash: tx.hash });
        
        toast({
          title: 'Transaction Sent',
          description: 'Your payment is being processed on the blockchain',
        });
        
        console.log('Updating payment record with transaction hash');
        // Step 3: Update payment record with transaction hash
        // This allows the system to monitor for confirmation
        const confirmResponse = await fetch(`/api/payments/${responseData.payment.id}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Wallet ${senderAddress}`,
          },
          body: JSON.stringify({
            transactionHash: tx.hash,
            forceCheck: true, // Request immediate checking
          }),
        });
        
        if (!confirmResponse.ok) {
          const confirmError = await confirmResponse.json();
          console.error('Error recording transaction hash:', confirmError);
          // Continue with UI flow even if this fails - the transaction is on-chain
          // The blockchain sync service will eventually find and update the payment
        } else {
          const confirmResult = await confirmResponse.json();
          console.log('Transaction hash recorded successfully', confirmResult);
          
          // If the transaction was already confirmed by the immediate check
          if (confirmResult.confirmed) {
            console.log('Transaction was confirmed immediately');
            toast({
              title: 'Payment Confirmed',
              description: `Successfully sent ${formData.amount} PYUSD to @${recipientInfo.username}`,
            });
            
            // Reset form
            setFormData({
              recipient: '',
              amount: '',
              notes: '',
            });
            setRecipientInfo(null);
            
            // Redirect or update UI as needed
            console.log('Calling onSuccess callback');
            onSuccess?.();
            setLoading(false);
            return; // Exit early since we're already confirmed
          }
        }
        
        // Step 4: Start polling for transaction confirmation
        // Poll every 5 seconds for up to 30 seconds (6 attempts)
        let attempts = 0;
        const maxAttempts = 6; // 30 seconds total (reduced from 60/5 minutes)
        const pollInterval = 5000; // 5 seconds
        let receivedSuccessResponse = false; // Track if we ever got a success response
        
        console.log(`[TxPoll] Starting to poll for confirmation of tx: ${tx.hash}`);
        
        const pollForConfirmation = async () => {
          if (attempts >= maxAttempts) {
            console.log(`[TxPoll] Max polling attempts (${maxAttempts}) reached for tx: ${tx.hash}`);
            
            // As a last resort, try one final force check through the API
            try {
              console.log(`[TxPoll] Attempting final force check for tx: ${tx.hash}`);
              const finalCheckResponse = await fetch(`/api/payments/tx?hash=${tx.hash}&forceCheck=true`);
              
              if (finalCheckResponse.ok) {
                const finalCheckData = await finalCheckResponse.json();
                
                if (finalCheckData.confirmed) {
                  console.log(`[TxPoll] Final check confirmed tx: ${tx.hash}`);
                  toast({
                    title: 'Payment Confirmed',
                    description: `Successfully sent ${formData.amount} PYUSD to @${recipientInfo.username}`,
                  });
                  
                  // Reset form
                  setFormData({
                    recipient: '',
                    amount: '',
                    notes: '',
                  });
                  setRecipientInfo(null);
                  
                  // Call success callback
                  onSuccess?.();
                  setLoading(false);
                  return;
                } else {
                  console.log(`[TxPoll] Even final check could not confirm tx: ${tx.hash}`);
                }
              }
            } catch (finalCheckError) {
              console.error(`[TxPoll] Error in final force check:`, finalCheckError);
            }
            
            // If we've received at least one successful response from the blockchain
            // but it's still not confirmed after all our attempts, show a "verification pending" message
            if (receivedSuccessResponse) {
              toast({
                title: 'Transaction Sent',
                description: 'Your transaction was sent but verification is taking longer than expected. Check your transaction history later for updates.',
              });
            } else {
              toast({
                title: 'Verification Timeout',
                description: 'We could not verify your transaction. Please check your transaction history later for updates.',
                variant: 'destructive',
              });
            }
            
            setLoading(false);
            return;
          }
          
          attempts++;
          console.log(`[TxPoll] Polling for confirmation... attempt ${attempts}/${maxAttempts} for tx: ${tx.hash}`);
          
          try {
            // Check transaction status through our API endpoint
            // This gives us better diagnostics and server-side verification
            const apiCheckResponse = await fetch(`/api/payments/tx?hash=${tx.hash}&forceCheck=true`);
            
            if (apiCheckResponse.ok) {
              const statusData = await apiCheckResponse.json();
              console.log(`[TxPoll] API response for tx ${tx.hash}:`, statusData);
              
              // Track that we got a successful response from the API
              receivedSuccessResponse = true;
              
              if (statusData.confirmed || (statusData.payment && statusData.payment.status === 'COMPLETED')) {
                console.log(`[TxPoll] Transaction confirmed via API! tx: ${tx.hash}`);
                
                toast({
                  title: 'Payment Confirmed',
                  description: `Successfully sent ${formData.amount} PYUSD to @${recipientInfo.username}`,
                });
                
                // Reset form
                setFormData({
                  recipient: '',
                  amount: '',
                  notes: '',
                });
                setRecipientInfo(null);
                
                // Call success callback
                console.log('[TxPoll] Calling onSuccess callback');
                onSuccess?.();
                setLoading(false);
                return;
              }
            } else {
              // API error - fall back to direct provider check
              console.error(`[TxPoll] API check failed for tx ${tx.hash}:`, await apiCheckResponse.text());
            }
            
            // If API check didn't confirm the transaction, try direct provider check as backup
            try {
              // Check if the transaction is confirmed
              const receipt = await provider.getTransactionReceipt(tx.hash);
              
              if (receipt) {
                receivedSuccessResponse = true; // We got a receipt, so the transaction exists
                
                console.log(`[TxPoll] Direct provider check receipt for tx ${tx.hash}:`, 
                  { blockNumber: receipt.blockNumber, status: receipt.status, confirmations: receipt.confirmations });
                
                if (receipt.status === 1) {
                  console.log(`[TxPoll] Transaction confirmed via direct provider! tx: ${tx.hash}`);
                  
                  // Force update the payment record through the API
                  try {
                    const updateResponse = await fetch(`/api/payments/${responseData.payment.id}/confirm`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Wallet ${senderAddress}`,
                      },
                      body: JSON.stringify({
                        transactionHash: tx.hash,
                        forceCheck: true,
                      }),
                    });
                    
                    if (updateResponse.ok) {
                      const updateData = await updateResponse.json();
                      console.log(`[TxPoll] Force update response:`, updateData);
                      
                      toast({
                        title: 'Payment Confirmed',
                        description: `Successfully sent ${formData.amount} PYUSD to @${recipientInfo.username}`,
                      });
                      
                      // Reset form
                      setFormData({
                        recipient: '',
                        amount: '',
                        notes: '',
                      });
                      setRecipientInfo(null);
                      
                      // Redirect or update UI as needed
                      console.log('[TxPoll] Calling onSuccess callback');
                      onSuccess?.();
                    } else {
                      console.error('[TxPoll] Failed to update payment record after confirmation');
                      const errorText = await updateResponse.text();
                      console.error('[TxPoll] Error response:', errorText);
                      
                      // Continue polling - next attempt might succeed
                      setTimeout(pollForConfirmation, pollInterval);
                      return;
                    }
                  } catch (updateError) {
                    console.error('[TxPoll] Error updating payment status:', updateError);
                    // Continue polling - next attempt might succeed
                    setTimeout(pollForConfirmation, pollInterval);
                    return;
                  }
                  
                  // Stop polling
                  setLoading(false);
                  return;
                } else if (receipt.status === 0) {
                  // Transaction failed on-chain
                  console.error('[TxPoll] Transaction failed on-chain', receipt);
                  toast({
                    title: 'Transaction Failed',
                    description: 'The transaction failed on the blockchain. Please check your wallet for details.',
                    variant: 'destructive',
                  });
                  
                  // Stop polling
                  setLoading(false);
                  return;
                }
              } else {
                console.log(`[TxPoll] No receipt yet for tx: ${tx.hash}`);
              }
            } catch (providerError) {
              console.error('[TxPoll] Error checking direct provider:', providerError);
              // Continue polling despite provider errors
            }
            
            // Transaction not yet confirmed, continue polling
            setTimeout(pollForConfirmation, pollInterval);
          } catch (error) {
            console.error('[TxPoll] Error checking transaction receipt:', error);
            // Continue polling even on errors
            setTimeout(pollForConfirmation, pollInterval);
          }
        };
        
        // Start polling
        pollForConfirmation();
      } catch (signerError) {
        console.error('Error getting signer or executing transaction:', signerError);
        setLoading(false);
        throw signerError;
      }
    } catch (error) {
      console.error('Error sending payment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  // Handle "Pay Max" button click
  const handlePayMax = () => {
    setFormData(prev => ({
      ...prev,
      amount: balance,
    }));
  };

  return (
    <>
      <form 
        onSubmit={(e) => {
          console.log('Form submit event triggered');
          handleSubmit(e);
        }} 
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Available balance: <span className="font-medium text-gray-900">{balance} PYUSD</span>
          </p>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => {
              console.log('Pay Max button clicked');
              handlePayMax();
            }}
            className="text-xs"
          >
            Pay Max
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="recipient" className="text-sm font-medium">
              Recipient Username
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                id="recipient"
                name="recipient"
                placeholder="username"
                className={`pl-9 ${recipientError ? 'border-red-500' : ''}`}
                value={formData.recipient}
                onChange={handleInputChange}
                onBlur={() => {
                  console.log('Validating recipient on blur');
                  validateRecipient();
                }}
                autoComplete="off"
                disabled={loading}
                readOnly={!!recipientInfo}
              />
              {validating && (
                <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 animate-spin" size={16} />
              )}
            </div>
            {recipientError && (
              <p className="text-sm text-red-500 mt-1">{recipientError}</p>
            )}
            {recipientInfo && (
              <div className="text-sm text-green-600 mt-1">
                Sending to: {recipientInfo.displayName || recipientInfo.username}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount (PYUSD)
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <PyusdIcon size={18} />
              </div>
              <Input
                id="amount"
                name="amount"
                placeholder="0.00"
                className="pl-9"
                value={formData.amount}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes (optional)
            </label>
            <div className="relative">
              <Textarea
                id="notes"
                name="notes"
                placeholder="What's this payment for?"
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
                disabled={loading}
                maxLength={NOTES_MAX_LENGTH}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {formData.notes.length}/{NOTES_MAX_LENGTH}
              </div>
            </div>
          </div>
        </div>
        
        {parseFloat(formData.amount) > parseFloat(balance) && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Insufficient Balance</AlertTitle>
            <AlertDescription>
              You do not have enough PYUSD to complete this transaction.
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          disabled={
            loading || 
            !formData.amount || 
            parseFloat(formData.amount) <= 0 || 
            parseFloat(formData.amount) > parseFloat(balance) || 
            !formData.recipient || 
            !!recipientError
          }
          onClick={() => {
            console.log('Send Payment button clicked');
            console.log('Form state', {
              loading,
              amount: formData.amount,
              recipient: formData.recipient,
              recipientError,
              balance
            });
          }}
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Send Payment'
          )}
        </Button>
      </form>
      
      {/* Debug button outside the form */}
      <div className="mt-4 p-3 border border-gray-300 rounded-md bg-gray-50">
        <p className="text-sm font-medium mb-2">Debug Tools</p>
        <Button 
          type="button"
          variant="secondary"
          onClick={async () => {
            console.log('Manual send button clicked');
            
            // Print detailed info about the current state
            console.log('Current form state:', {
              formData,
              recipientInfo,
              senderAddress,
              balance
            });
            
            // Validate recipient if not already validated
            if (!recipientInfo || !recipientInfo.walletAddress) {
              console.log('Need to validate recipient first');
              await validateRecipient();
              
              // Check if validation succeeded
              if (!recipientInfo || !recipientInfo.walletAddress) {
                console.error('Failed to validate recipient or get wallet address');
                toast({
                  title: 'Validation Failed',
                  description: 'Could not validate recipient or get wallet address',
                  variant: 'destructive',
                });
                return;
              }
            }
            
            // Ensure wallet is connected by requesting accounts
            try {
              if (window.ethereum) {
                console.log('Requesting Ethereum accounts before proceeding');
                await window.ethereum.request({ method: 'eth_requestAccounts' });
              }
            } catch (error) {
              console.error('Error requesting accounts:', error);
              toast({
                title: 'Wallet Connection Error',
                description: 'Unable to connect to your wallet',
                variant: 'destructive',
              });
              return;
            }
            
            // Create a synthetic event
            const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
            handleSubmit(syntheticEvent);
          }}
          className="w-full"
        >
          Manual Send (Debug)
        </Button>
      </div>
    </>
  );
};

export default SendPaymentForm;
