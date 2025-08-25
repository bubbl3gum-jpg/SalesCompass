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

interface StaffAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (staff: any) => void;
}

export function StaffAuthModal({ open, onOpenChange, onSuccess }: StaffAuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const authMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest('POST', '/api/staff/auth', credentials);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Staff Login Successful",
        description: `Welcome, ${data.staff.namaLengkap || data.staff.email}`,
      });
      
      // Clear form
      setEmail('');
      setPassword('');
      
      // Refresh staff query
      queryClient.invalidateQueries({ queryKey: ['/api/staff/current'] });
      
      onOpenChange(false);
      onSuccess?.(data.staff);
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    authMutation.mutate({
      email,
      password,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Staff Login</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              data-testid="input-email"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              data-testid="input-password"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={authMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={authMutation.isPending}
              data-testid="button-login"
            >
              {authMutation.isPending ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}