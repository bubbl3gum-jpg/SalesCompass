import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8">
            <i className="fas fa-chart-line text-white text-3xl"></i>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            SalesStock Management
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            Complete Live Sales Recap & Stock management system with RBAC, 
            complex pricing logic, and real-time inventory tracking.
          </p>

          <Card className="w-full max-w-md bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Welcome Back
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Sign in to access your dashboard and manage your operations
              </p>
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-shield-alt text-white text-2xl"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Role-Based Access
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                6 different roles with specific permissions for secure operations
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-calculator text-white text-2xl"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Smart Pricing
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Complex price resolution with fallback logic and discount management
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-chart-bar text-white text-2xl"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Real-time Analytics
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Live dashboards with sales tracking and inventory management
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
