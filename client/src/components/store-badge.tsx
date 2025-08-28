import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const StoreBadge = memo(() => {
  const { user, switchStoreMutation } = useStoreAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switchData, setSwitchData] = useState({
    password: "",
    store_id: "",
    store_password: "",
  });

  if (!user) return null;

  const handleSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    switchStoreMutation.mutate(switchData, {
      onSuccess: () => {
        setIsOpen(false);
        setSwitchData({ password: "", store_id: "", store_password: "" });
      },
    });
  };

  return (
    <>
      <Badge
        variant="secondary"
        className="flex items-center gap-1.5 px-3 py-1.5"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-medium">{user.store_name}</span>
        <span className="text-xs text-muted-foreground">({user.store_id})</span>
      </Badge>

      {user.can_access_all_stores && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              title="Switch Store"
              data-testid="button-switch-store"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSwitch}>
              <DialogHeader>
                <DialogTitle>Switch Store</DialogTitle>
                <DialogDescription>
                  Re-authenticate to switch to a different store. You are currently in: {user.store_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="switch-password">Your Password</Label>
                  <Input
                    id="switch-password"
                    type="password"
                    placeholder="Enter your password"
                    value={switchData.password}
                    onChange={(e) => setSwitchData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="switch-store-id">New Store Code</Label>
                  <Input
                    id="switch-store-id"
                    type="text"
                    placeholder="e.g., B-C.SC"
                    value={switchData.store_id}
                    onChange={(e) => setSwitchData(prev => ({ ...prev, store_id: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="switch-store-password">Store Password</Label>
                  <Input
                    id="switch-store-password"
                    type="password"
                    placeholder="Enter store password"
                    value={switchData.store_password}
                    onChange={(e) => setSwitchData(prev => ({ ...prev, store_password: e.target.value }))}
                    required
                  />
                </div>

                {switchStoreMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {switchStoreMutation.error?.message || "Store switch failed"}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={switchStoreMutation.isPending}
                  data-testid="button-confirm-switch"
                >
                  {switchStoreMutation.isPending ? "Switching..." : "Switch Store"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});

StoreBadge.displayName = "StoreBadge";