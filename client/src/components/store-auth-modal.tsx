import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores?: any[];
  onSuccess?: (store: any) => void;
  canSwitchStores?: boolean;
  currentStore?: any;
}

export function StoreAuthModal({ open, onOpenChange, stores = [], onSuccess, canSwitchStores = false, currentStore }: StoreAuthModalProps) {
  const [selectedStore, setSelectedStore] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const authMutation = useMutation({
    mutationFn: async (credentials: { kodeGudang: string; username: string; password: string }) => {
      const response = await apiRequest('POST', '/api/store/auth', credentials);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Store Authentication Successful",
        description: `You are now logged into ${data.store.namaGudang}`,
      });
      
      // Clear form
      setSelectedStore('');
      setUsername('');
      setPassword('');
      
      // Refresh current store query
      queryClient.invalidateQueries({ queryKey: ['/api/store/current'] });
      
      onOpenChange(false);
      onSuccess?.(data.store);
    },
    onError: (error: any) => {
      toast({
        title: "Authentication Failed",
        description: error.message || "Invalid store credentials",
        variant: "destructive",
      });
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (storeCode: string) => {
      const response = await apiRequest('POST', '/api/store/switch', { kodeGudang: storeCode });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Store Switched Successfully",
        description: `You are now viewing ${data.store.namaGudang}`,
      });
      
      // Clear form
      setSelectedStore('');
      
      // Refresh current store query
      queryClient.invalidateQueries({ queryKey: ['/api/store/current'] });
      
      onOpenChange(false);
      onSuccess?.(data.store);
    },
    onError: (error: any) => {
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch store",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStore) {
      toast({
        title: "Missing Information",
        description: "Please select a store",
        variant: "destructive",
      });
      return;
    }

    // If user can switch stores (All Store user), use switch mutation
    if (canSwitchStores && currentStore) {
      switchMutation.mutate(selectedStore);
    } else {
      // Regular authentication
      if (!username || !password) {
        toast({
          title: "Missing Information",
          description: "Please fill in all fields",
          variant: "destructive",
        });
        return;
      }

      authMutation.mutate({
        kodeGudang: selectedStore,
        username,
        password,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {canSwitchStores && currentStore ? 'Switch Store' : 'Store Authentication'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="store">Store</Label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger data-testid="select-store">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                    {store.namaGudang} ({store.kodeGudang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Only show username/password fields if not switching stores */}
          {!(canSwitchStores && currentStore) && (
            <>
              <div>
                <Label htmlFor="username">Store Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter store username"
                  data-testid="input-username"
                />
              </div>

              <div>
                <Label htmlFor="password">Store Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter store password"
                  data-testid="input-password"
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={authMutation.isPending || switchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={authMutation.isPending || switchMutation.isPending}
              data-testid="button-authenticate"
            >
              {(authMutation.isPending || switchMutation.isPending) 
                ? (canSwitchStores && currentStore ? 'Switching...' : 'Authenticating...') 
                : (canSwitchStores && currentStore ? 'Switch Store' : 'Login to Store')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}