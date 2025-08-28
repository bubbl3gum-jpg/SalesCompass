import { useState, useCallback, useMemo, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/sidebar";
import { Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

// Remove lazy loading to fix primitive value error
// const OptimizedDataTable = lazy(() => import("@/components/OptimizedDataTable"));
// const ImportModal = lazy(() => import("@/components/import-modal"));

// Minimal table configuration for faster rendering
const TAB_CONFIGS = {
  'reference-sheet': {
    name: 'reference-sheet',
    displayName: 'Reference Sheet',
    endpoint: '/api/reference-sheets',
    keyField: 'kodeItem',
    searchable: true,
  },
  'stores': {
    name: 'stores',
    displayName: 'Stores',
    endpoint: '/api/stores',
    keyField: 'kodeGudang',
    searchable: true,
  },
  'positions': {
    name: 'positions', 
    displayName: 'Positions',
    endpoint: '/api/positions',
    keyField: 'positionId',
    searchable: false,
  },
  'staff': {
    name: 'staff',
    displayName: 'Staff',
    endpoint: '/api/staff',
    keyField: 'nik',
    searchable: true,
  },
  'discounts': {
    name: 'discounts',
    displayName: 'Discounts',
    endpoint: '/api/discounts',
    keyField: 'discountId',
    searchable: false,
  },
  'edc': {
    name: 'edc',
    displayName: 'EDC / Payment Methods',
    endpoint: '/api/edc',
    keyField: 'edcId',
    searchable: true,
  },
} as const;

// Optimized data fetching with aggressive caching
function useOptimizedTableData(endpoint: string, enabled = true, searchQuery = '') {
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  return useQuery({
    queryKey: [endpoint, debouncedSearch],
    queryFn: async () => {
      let url = endpoint;
      if (debouncedSearch) {
        url += `?search=${encodeURIComponent(debouncedSearch)}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 min cache
        },
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes in memory
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Memoized search component
const SearchBox = memo(({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => (
  <div className="relative w-64">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
));

SearchBox.displayName = 'SearchBox';

// Loading skeleton for table
const TableSkeleton = memo(() => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

// Ultra-optimized tab content
const TabContent = memo(({ 
  config, 
  searchQuery, 
  onSearchChange 
}: {
  config: typeof TAB_CONFIGS[keyof typeof TAB_CONFIGS];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) => {
  const { data = [], isLoading, error } = useOptimizedTableData(
    config.endpoint, 
    true, 
    searchQuery
  );

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(data.map((item: any) => item[config.keyField])));
    } else {
      setSelectedItems(new Set());
    }
  }, [data, config.keyField]);

  const handleSelectItem = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const handleEdit = useCallback((item: any) => {
    console.log('Edit:', item);
  }, []);

  const handleDelete = useCallback((item: any) => {
    console.log('Delete:', item);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-500">
        Error loading data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{config.displayName}</h3>
        <div className="flex gap-2">
          {config.searchable && (
            <SearchBox
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={`Search ${config.displayName.toLowerCase()}...`}
            />
          )}
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
          <Button size="sm" variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="border rounded-lg">
          <div className="p-4 bg-gray-50 border-b">
            <h4 className="font-medium">Data loaded successfully</h4>
            <p className="text-sm text-gray-600">Found {data.length} items</p>
          </div>
          <div className="p-4">
            {data.length === 0 ? (
              <p className="text-center text-gray-500">No data found</p>
            ) : (
              <div className="space-y-2">
                {data.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="p-2 border rounded text-xs">
                    <pre>{JSON.stringify(item, null, 2)}</pre>
                  </div>
                ))}
                {data.length > 5 && (
                  <p className="text-center text-gray-500">... and {data.length - 5} more items</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TabContent.displayName = 'TabContent';

export default function AdminSettingsUltraOptimized() {
  const { user } = useStoreAuth();
  const { isExpanded } = useSidebar();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<keyof typeof TAB_CONFIGS>('reference-sheet');
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  const handleSearchChange = useCallback((tab: string, value: string) => {
    setSearchQueries(prev => ({ ...prev, [tab]: value }));
  }, []);

  const currentConfig = TAB_CONFIGS[activeTab];
  const searchQuery = searchQueries[activeTab] || '';

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need to be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className={cn("flex-1 flex flex-col transition-all", isExpanded ? "ml-64" : "ml-16")}>
        <div className="flex-1 p-6 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Admin Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage system settings, master data, and user permissions.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs value={String(activeTab)} onValueChange={(value) => setActiveTab(value as keyof typeof TAB_CONFIGS)}>
                <TabsList className="grid w-full grid-cols-6">
                  {Object.entries(TAB_CONFIGS).map(([key, config]) => (
                    <TabsTrigger key={String(key)} value={String(key)}>
                      {String(config.displayName)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(TAB_CONFIGS).map(([key, config]) => (
                  <TabsContent key={String(key)} value={String(key)} className="mt-6">
                    <TabContent
                      config={config}
                      searchQuery={searchQuery}
                      onSearchChange={(value) => handleSearchChange(String(key), value)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}