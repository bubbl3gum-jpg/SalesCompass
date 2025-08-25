import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storePassword, setStorePassword] = useState("");
  const [rememberUser, setRememberUser] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showStorePassword, setShowStorePassword] = useState(false);
  const [isStoreOnlyLogin, setIsStoreOnlyLogin] = useState(false);

  // Load saved user info
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_user_email');
    const savedUserExpiry = localStorage.getItem('saved_user_expiry');
    
    if (savedEmail && savedUserExpiry) {
      const expiryTime = new Date(savedUserExpiry);
      if (new Date() < expiryTime) {
        setEmail(savedEmail);
        setIsStoreOnlyLogin(true);
      } else {
        // Clear expired data
        localStorage.removeItem('saved_user_email');
        localStorage.removeItem('saved_user_expiry');
      }
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleDemoLogin = () => {
    setEmail("demo@company.com");
    setPassword("demo123");
    setStoreId("STORE001");
    setStorePassword("store123");
  };

  const handleLogin = () => {
    // Redirect to Replit Auth login
    window.location.href = "/api/login";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const clearSavedUser = () => {
    localStorage.removeItem('saved_user_email');
    localStorage.removeItem('saved_user_expiry');
    setEmail("");
    setIsStoreOnlyLogin(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Side - Login Form */}
        <div className="flex items-center justify-center p-8">
          <Card className="w-full max-w-md bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-chart-line text-white text-2xl"></i>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                {isStoreOnlyLogin ? "Select Store" : "Sign In"}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                {isStoreOnlyLogin 
                  ? `Welcome back, ${email.split('@')[0]}! Please select your store.`
                  : "Access your SalesStock dashboard"
                }
              </p>
              {isStoreOnlyLogin && (
                <Badge 
                  variant="outline" 
                  className="mx-auto cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={clearSavedUser}
                  data-testid="badge-clear-user"
                >
                  Not you? Click to change user
                </Badge>
              )}
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isStoreOnlyLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50"
                        data-testid="input-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50 pr-10"
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-500`}></i>
                        </Button>
                      </div>
                    </div>

                    <Separator className="bg-white/20 dark:bg-gray-700/50" />
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="storeId" className="text-gray-700 dark:text-gray-300">
                    Store ID
                  </Label>
                  <Input
                    id="storeId"
                    type="text"
                    placeholder="STORE001"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    required
                    className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50"
                    data-testid="input-store-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storePassword" className="text-gray-700 dark:text-gray-300">
                    Store Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="storePassword"
                      type={showStorePassword ? "text" : "password"}
                      placeholder="Enter store password"
                      value={storePassword}
                      onChange={(e) => setStorePassword(e.target.value)}
                      required
                      className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50 pr-10"
                      data-testid="input-store-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => setShowStorePassword(!showStorePassword)}
                      data-testid="button-toggle-store-password"
                    >
                      <i className={`fas ${showStorePassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-500`}></i>
                    </Button>
                  </div>
                </div>

                {!isStoreOnlyLogin && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberUser}
                      onCheckedChange={(checked) => setRememberUser(checked as boolean)}
                      data-testid="checkbox-remember-user"
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                      Remember me for 7 days
                    </Label>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  disabled={isLoggingIn}
                  data-testid="button-sign-in"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                {!isStoreOnlyLogin && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20 dark:border-gray-700/50" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white/10 dark:bg-black/10 px-2 text-gray-500 dark:text-gray-400">
                          Quick Access
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/20 dark:border-gray-700/50 hover:bg-white/10 dark:hover:bg-black/10"
                        onClick={handleDemoLogin}
                        data-testid="button-demo-login"
                      >
                        <i className="fas fa-user-circle mr-2"></i>
                        Demo Login
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/20 dark:border-gray-700/50 hover:bg-white/10 dark:hover:bg-black/10"
                        onClick={handleLogin}
                        data-testid="button-google-login"
                      >
                        <i className="fab fa-google mr-2 text-red-500"></i>
                        Continue with Google
                      </Button>
                    </div>
                  </>
                )}
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  For internal employee use only. All activity is monitored.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Hero Section */}
        <div className="hidden lg:flex items-center justify-center p-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
          <div className="text-white text-center max-w-md">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <i className="fas fa-store text-4xl"></i>
            </div>
            <h1 className="text-4xl font-bold mb-4">SalesStock Management</h1>
            <p className="text-xl text-blue-100 mb-8">
              Comprehensive sales tracking and inventory management system for retail operations
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white/10 rounded-lg p-4">
                <i className="fas fa-chart-line text-2xl mb-2"></i>
                <div className="font-semibold">Real-time Sales</div>
                <div className="text-blue-200">Live sales tracking</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <i className="fas fa-boxes text-2xl mb-2"></i>
                <div className="font-semibold">Inventory Control</div>
                <div className="text-blue-200">Stock management</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <i className="fas fa-users text-2xl mb-2"></i>
                <div className="font-semibold">Multi-Store Support</div>
                <div className="text-blue-200">Centralized operations</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <i className="fas fa-analytics text-2xl mb-2"></i>
                <div className="font-semibold">Advanced Analytics</div>
                <div className="text-blue-200">Business insights</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}