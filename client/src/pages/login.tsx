import { useState, useEffect } from "react";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, User, Lock, Store, Loader2 } from "lucide-react";

export default function Login() {
  const { user, loginMutation } = useStoreAuth();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    store_id: "",
    store_password: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Sales & Stock Login</CardTitle>
          <CardDescription>
            Enter your credentials and store information to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Credentials Section */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                User Credentials
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username or Email</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your NIK or email"
                  value={formData.username}
                  onChange={handleInputChange("username")}
                  required
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange("password")}
                  required
                  data-testid="input-password"
                />
              </div>
            </div>

            <div className="border-t pt-4" />

            {/* Store Credentials Section */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Store className="h-4 w-4" />
                Store Information
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="store_id">Store Code</Label>
                <Input
                  id="store_id"
                  type="text"
                  placeholder="e.g., B-C.SC"
                  value={formData.store_id}
                  onChange={handleInputChange("store_id")}
                  required
                  data-testid="input-store-id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_password">Store Password</Label>
                <Input
                  id="store_password"
                  type="password"
                  placeholder="Enter store password"
                  value={formData.store_password}
                  onChange={handleInputChange("store_password")}
                  required
                  data-testid="input-store-password"
                />
              </div>
            </div>

            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {loginMutation.error?.message || "Login failed. Please check your credentials."}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Login
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">Sample Login Credentials:</p>
              <div className="text-xs space-y-1">
                <p><strong>Username:</strong> admin@test.com or ADMIN001</p>
                <p><strong>Password:</strong> admin123</p>
                <p><strong>Store Code:</strong> TEST-01</p>
                <p><strong>Store Password:</strong> store123</p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="mb-2">Access levels:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>System Administrator:</strong> Full system access</li>
                <li>• <strong>SPG:</strong> Sales, Settlements, Transfers</li>
                <li>• <strong>Supervisor:</strong> SPG + Store Overview</li>
                <li>• <strong>Stockist:</strong> Stock management</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}