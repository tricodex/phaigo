'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Calendar, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, addDays } from 'date-fns';
import PyusdIcon from '@/components/ui/pyusd-icon';
import { QRCodeSVG } from 'qrcode.react';

// Add this constant at the top of the file
const NOTES_MAX_LENGTH = 200;

interface RequestPaymentFormProps {
  userAddress?: string;
  onSuccess?: () => void;
}

const RequestPaymentForm = ({ 
  userAddress, 
  onSuccess 
}: RequestPaymentFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    amount: '',
    notes: '',
    expires: false,
    expireDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  });
  const [loading, setLoading] = useState(false);
  const [requestUrl, setRequestUrl] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const router = useRouter();

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

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userAddress) {
      toast({
        title: 'Error',
        description: 'Wallet not connected. Please connect your wallet to create a payment request.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate amount
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    // Reset any previous errors
    setQrCodeError(null);
    
    // Proceed with creating the request
    try {
      setLoading(true);
      
      // Create payment request
      const requestBody: { 
        amount: string; 
        notes: string; 
        expiresAt?: string;
      } = {
        amount: formData.amount,
        notes: formData.notes,
      };
      
      // Add expiration date if selected
      if (formData.expires && formData.expireDate) {
        requestBody.expiresAt = new Date(formData.expireDate).toISOString();
      }
      
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${userAddress}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Request Created',
          description: `Payment request for ${formData.amount} PYUSD has been created`,
        });
        
        // If we have a request ID, navigate to the request page
        if (responseData.request?.id) {
          // Store the request ID
          const requestId = responseData.request.id;
          
          // Execute success callback if provided (not replacing the redirect)
          if (onSuccess) {
            onSuccess();
          } else {
            // Redirect to the request page
            router.push(`/request/${requestId}`);
          }
        } else {
          console.error('Request created but no ID returned', responseData);
          toast({
            title: 'Request Created',
            description: 'Request was created but we cannot display details right now',
          });
        }
      } else {
        console.error('Request creation failed:', responseData);
        toast({
          title: 'Request Failed',
          description: responseData.error || 'Failed to create payment request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating payment request:', error);
      setQrCodeError(error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Copy request URL to clipboard
  const copyRequestUrl = () => {
    if (requestUrl) {
      navigator.clipboard.writeText(requestUrl)
        .then(() => {
          toast({
            title: 'Link Copied',
            description: 'Payment request link copied to clipboard',
          });
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          toast({
            title: 'Copy Failed',
            description: 'Failed to copy link to clipboard',
            variant: 'destructive',
          });
        });
    }
  };

  // View request details
  const viewRequest = () => {
    if (requestId) {
      window.open(`/request/${requestId}`, '_blank');
    }
  };

  // Cancel request
  const cancelRequest = async () => {
    if (!requestId || !userAddress) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Wallet ${userAddress}`,
        },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Request Canceled',
          description: 'Your payment request has been canceled',
        });
        
        // Reset form and state
        setRequestUrl(null);
        setRequestId(null);
        setFormData({
          amount: '',
          notes: '',
          expires: false,
          expireDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to cancel request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error canceling request:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {requestUrl ? (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-800 mb-2">Payment Request Created</h3>
            <p className="text-green-700 text-sm mb-4">
              Share this link with anyone to request {formData.amount} PYUSD
            </p>
            
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 p-3 bg-white rounded-lg text-sm font-medium truncate border border-green-200">
                {requestUrl}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyRequestUrl}
                className="flex-shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-lg">
                {qrCodeError ? (
                  <div className="text-red-500 text-sm">
                    Error generating QR code: {qrCodeError}
                  </div>
                ) : (
                  <QRCodeSVG
                    value={requestUrl}
                    size={150}
                    bgColor={'#FFFFFF'}
                    fgColor={'#000000'}
                    level={'L'}
                    includeMargin={false}
                  />
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={viewRequest}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Request
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={cancelRequest}
              >
                Cancel Request
              </Button>
            </div>
          </div>
          
          <Button
            onClick={() => {
              setRequestUrl(null);
              setRequestId(null);
              setFormData({
                amount: '',
                notes: '',
                expires: false,
                expireDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
              });
            }}
            className="w-full"
          >
            Create Another Request
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Request Amount (PYUSD)
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
                Request Reason (optional)
              </label>
              <div className="relative">
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="What's this request for?"
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
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="expires" 
                checked={formData.expires}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({
                    ...prev,
                    expires: checked === true
                  }));
                }}
              />
              <label
                htmlFor="expires"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Set expiration date
              </label>
            </div>
            
            {formData.expires && (
              <div className="space-y-2 pl-6">
                <label htmlFor="expireDate" className="text-sm font-medium">
                  Expires On
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="expireDate"
                    name="expireDate"
                    type="date"
                    className="pl-9"
                    value={formData.expireDate}
                    onChange={handleInputChange}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            disabled={loading || !formData.amount || parseFloat(formData.amount) <= 0}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Creating Request...
              </>
            ) : (
              'Create Payment Request'
            )}
          </Button>
        </form>
      )}
    </div>
  );
};

export default RequestPaymentForm;
