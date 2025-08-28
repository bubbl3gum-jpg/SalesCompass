import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/sidebar";
import { ImportProgress } from "@/components/ImportProgress";
import { useSearchParams } from "wouter";

// Lazy load tab components for code splitting
const ReferenceSheetTab = lazy(() => import("@/components/admin/ReferenceSheetTab"));
const StoresTab = lazy(() => import("@/components/admin/StoresTab"));
const PositionsTab = lazy(() => import("@/components/admin/PositionsTab"));
const StaffTab = lazy(() => import("@/components/admin/StaffTab"));
const EDCTab = lazy(() => import("@/components/admin/EDCTab"));

// Loading component for lazy-loaded tabs
const TabLoader = () => (
  <Card>
    <CardContent className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AdminSettingsOptimized() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { isOpen } = useSidebar();
  const { toast } = useToast();
  const [, setSearchParams] = useSearchParams();
  
  // Use URL params for tab state to enable deep linking
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "reference-sheet";
  
  // Import progress state - only when needed
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle tab changes via URL
  const handleTabChange = (value: string) => {
    setSearchParams(`tab=${value}`);
  };

  // Tab configuration
  const tabs = useMemo(() => [
    { id: 'reference-sheet', label: 'Reference Sheet', component: ReferenceSheetTab },
    { id: 'stores', label: 'Stores', component: StoresTab },
    { id: 'positions', label: 'Positions', component: PositionsTab },
    { id: 'staff', label: 'Staff', component: StaffTab },
    { id: 'edc', label: 'EDC / Payment Methods', component: EDCTab },
  ], []);

  if (authLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <TabLoader />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          isOpen ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Admin Settings</h1>
            <p className="text-muted-foreground">Manage system configuration and master data</p>
          </div>

          {/* Import Progress - Only shown when importing */}
          {isImporting && currentImportId && (
            <div className="mb-6">
              <ImportProgress 
                importId={currentImportId} 
                onComplete={() => {
                  setIsImporting(false);
                  setCurrentImportId(null);
                }}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="space-y-4">
                <Suspense fallback={<TabLoader />}>
                  {activeTab === tab.id && (
                    <tab.component
                      onImportStart={(importId: string) => {
                        setCurrentImportId(importId);
                        setIsImporting(true);
                      }}
                    />
                  )}
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// Helper function for classnames
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}