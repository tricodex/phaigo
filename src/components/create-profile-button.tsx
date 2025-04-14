"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface CreateProfileButtonProps {
  walletAddress?: string;
  onProfileCreated?: (username: string) => void;
}

export function CreateProfileButton({ walletAddress, onProfileCreated }: CreateProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateProfile = async () => {
    if (!walletAddress) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      
      // This would be replaced with your actual API call
      // to create a profile on your backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Profile created",
        description: `Your profile @${username} has been created successfully`,
      });
      
      if (onProfileCreated) {
        onProfileCreated(username);
      }
      
      setOpen(false);
      
      // Reset form
      setUsername('');
      setBio('');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Profile creation failed",
        description: "Failed to create your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Create Profile
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create your profile</DialogTitle>
            <DialogDescription>
              Create a profile to start receiving PYUSD tips and connect with others.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-3"
                placeholder="your_username"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bio" className="text-right">
                Bio
              </Label>
              <Input
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="col-span-3"
                placeholder="Tell us about yourself"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wallet-address" className="text-right">
                Wallet
              </Label>
              <Input
                id="wallet-address"
                value={walletAddress || 'Not connected'}
                disabled
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isCreating || !walletAddress} onClick={handleCreateProfile}>
              {isCreating ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CreateProfileButton;