import { useState, useCallback, useMemo, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useGlobalStore } from "@/hooks/useGlobalStore";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImportModal } from "@/components/import-modal";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit3, Trash2, Plus, Upload, Search, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportProgress } from "@/components/ImportProgress";
import { SearchInput } from "@/components/SearchInput";

interface TableConfig {
  name: string;
  displayName: string;
  endpoint: string;
  importTable: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'email' | 'password' | 'tel';
    required?: boolean;
    options?: { value: string; label: string }[];
  }[];
  keyField: string;
}

const tableConfigs: TableConfig[] = [
  {
    name: 'stores',
    displayName: 'Stores',
    endpoint: '/api/stores',
    importTable: 'stores',
    keyField: 'kodeGudang',
    fields: [
      { key: 'kodeGudang', label: 'Store Code', type: 'text', required: true },
      { key: 'namaGudang', label: 'Store Name', type: 'text', required: true },
      { key: 'jenisGudang', label: 'Store Type', type: 'text' },
      { key: 'storePassword', label: 'Store Password', type: 'password', required: true },
    ]
  },
  {
    name: 'positions',
    displayName: 'Positions',
    endpoint: '/api/positions',
    importTable: 'positions',
    keyField: 'positionId',
    fields: [
      { key: 'positionName', label: 'Position Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'canAccessDashboard', label: 'Dashboard Access', type: 'checkbox' },
      { key: 'canAccessSalesEntry', label: 'Sales Entry Access', type: 'checkbox' },
      { key: 'canAccessSettlements', label: 'Settlements Access', type: 'checkbox' },
      { key: 'canAccessStockDashboard', label: 'Stock Dashboard Access', type: 'checkbox' },
      { key: 'canAccessStockOpname', label: 'Stock Opname Access', type: 'checkbox' },
      { key: 'canAccessTransfers', label: 'Transfers Access', type: 'checkbox' },
      { key: 'canAccessPriceLists', label: 'Price Lists Access', type: 'checkbox' },
      { key: 'canAccessAdminSettings', label: 'Admin Settings Access', type: 'checkbox' },
    ]
  },
  {
    name: 'staff',
    displayName: 'Staff',
    endpoint: '/api/staff',
    importTable: 'staff',
    keyField: 'nik',
    fields: [
      { key: 'nik', label: 'NIK', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'namaLengkap', label: 'Full Name', type: 'text', required: true },
      { key: 'kota', label: 'City', type: 'text', required: true },
      { key: 'alamat', label: 'Address', type: 'text', required: true },
      { key: 'noHp', label: 'Phone Number', type: 'tel', required: true },
      { key: 'tempatLahir', label: 'Place of Birth', type: 'text', required: true },
      { key: 'tanggalLahir', label: 'Date of Birth', type: 'date', required: true },
      { key: 'tanggalMasuk', label: 'Date Joined', type: 'date', required: true },
      { key: 'jabatan', label: 'Position', type: 'select', required: true, options: [] },
    ]
  }
];

function useTableData(endpoint: string, enabled = true, page = 1, limit = 100) {
  return useQuery({
    queryKey: [endpoint, { page, limit }],
    queryFn: async () => {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      
      const response = await fetch(url.toString(), {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        return { data, total: data.length, page, limit };
      }
      return data;
    },
    retry: false,
    enabled, // Only fetch when enabled is true
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: false, // Don't refetch if data exists
  });
}

export default function AdminSettings() {
  const { user } = useStoreAuth();
  
  // Early return check BEFORE any other hooks
  if (!user) {
    return <div>Please log in to access admin settings.</div>;
  }
  
  const { isExpanded } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { shouldUseGlobalStore } = useGlobalStore();

  const [activeTab, setActiveTab] = useState('stores');
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadData, setBulkUploadData] = useState<any[]>([]);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ 
    uploading: boolean; 
    results: { processed: number; created: number; errors: any[] } | null 
  }>({ uploading: false, results: null });
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const [itemsPerPage] = useState(15); // Much smaller chunks for better performance
  const [maxDisplayItems] = useState(10); // Maximum items to render in DOM at once

  // Always call all hooks, but control their enabling based on active tab
  const storesQuery = useTableData('/api/stores', activeTab === 'stores', currentPage['stores'] || 1, itemsPerPage);
  const positionsQuery = useTableData('/api/positions', activeTab === 'positions' || activeTab === 'staff', currentPage['positions'] || 1, itemsPerPage);
  const staffQuery = useTableData('/api/staff', activeTab === 'staff', currentPage['staff'] || 1, itemsPerPage);

  // Get positions data for staff form
  const positions = positionsQuery.data || [];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // Data Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Search and Import Progress State with debouncing
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [debouncedSearchQueries, setDebouncedSearchQueries] = useState<Record<string, string>>({});
  
  // Debounce search to prevent constant filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQueries(searchQueries);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [searchQueries]);
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{endpoint: string, id: string, name?: string} | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle tab changes with cleanup to improve performance
  const handleTabChange = useCallback((newTab: string) => {
    // Clear selections and search when switching tabs to prevent memory issues
    setSelectedItems(new Set());
    setSelectAll(false);
    setSearchQueries(prev => ({ ...prev, [activeTab]: '' })); // Clear search for current tab
    setActiveTab(newTab);
  }, [activeTab]);

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean, data: any[], config: TableConfig) => {
    if (checked) {
      const allIds = new Set(data.map(item => item[config.keyField]));
      setSelectedItems(allIds);
      setSelectAll(true);
    } else {
      setSelectedItems(new Set());
      setSelectAll(false);
    }
  }, []);

  const handleSelectItem = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
        setSelectAll(false);
      }
      return newSelected;
    });
  }, []);

  const handleBulkDelete = (config: TableConfig) => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select items to delete",
        variant: "destructive",
      });
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    const config = getCurrentConfig();
    if (!config) return;

    try {
      for (const itemId of Array.from(selectedItems)) {
        await apiRequest('DELETE', `${config.endpoint}/${itemId}`);
      }
      
      queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      setSelectedItems(new Set());
      setSelectAll(false);
      setShowBulkDeleteConfirm(false);
      
      toast({
        title: "Success",
        description: `Deleted ${selectedItems.size} items`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: (error as Error).message || "Failed to delete items",
        variant: "destructive",
      });
    }
  };

  const getCurrentConfig = useCallback(() => {
    const config = tableConfigs.find(config => config.name === activeTab);
    // Dynamically populate position options for staff
    if (config?.name === 'staff') {
      const updatedConfig = { ...config };
      const jabatanField = updatedConfig.fields.find(f => f.key === 'jabatan');
      if (jabatanField && Array.isArray(positions) && positions.length > 0) {
        jabatanField.options = positions.map((pos: any) => ({
          value: pos.positionName,
          label: pos.positionName
        }));
      }
      return updatedConfig;
    }
    return config;
  }, [activeTab, positions]);

  const deleteMutation = useMutation({
    mutationFn: async ({ endpoint, id }: { endpoint: string; id: string }) => {
      const response = await apiRequest('DELETE', `${endpoint}/${id}`);
      return response;
    },
    onSuccess: () => {
      const config = getCurrentConfig();
      if (config) {
        queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      }
      
      toast({
        title: "Success",
        description: "Record deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.replace("/api/login");
        }, 500);
        return;
      }
      
      toast({
        title: "Delete Failed",
        description: (error as Error).message || "Failed to delete record",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const config = getCurrentConfig();
      if (!config) throw new Error('No configuration found');
      
      const response = await apiRequest('POST', config.endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      const config = getCurrentConfig();
      if (config) {
        queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      }
      
      setShowCreateModal(false);
      setFormData({});
      
      toast({
        title: "Success",
        description: "Record created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.replace("/api/login");
        }, 500);
        return;
      }
      
      toast({
        title: "Creation Failed",
        description: (error as Error).message || "Failed to create record",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const config = getCurrentConfig();
      if (!config || !editingItem) throw new Error('No configuration or item found');
      
      const response = await apiRequest('PUT', `${config.endpoint}/${editingItem}`, data);
      return response.json();
    },
    onSuccess: () => {
      const config = getCurrentConfig();
      if (config) {
        // Invalidate and refetch immediately to show updated data
        queryClient.invalidateQueries({ queryKey: [config.endpoint] });
        queryClient.refetchQueries({ queryKey: [config.endpoint] });
      }
      
      setShowEditModal(false);
      setEditingItem(null);
      setFormData({});
      setShowPassword(false); // Reset password visibility
      
      toast({
        title: "Success",
        description: "Record updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.replace("/api/login");
        }, 500);
        return;
      }
      
      toast({
        title: "Update Failed",
        description: (error as Error).message || "Failed to update record",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (endpoint: string, id: string, itemName?: string) => {
    setDeletingItem({ endpoint, id, name: itemName });
  };

  const confirmDelete = () => {
    if (deletingItem) {
      deleteMutation.mutate({ endpoint: deletingItem.endpoint, id: deletingItem.id });
      setDeletingItem(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImportSuccess = () => {
    const config = getCurrentConfig();
    if (config) {
      queryClient.invalidateQueries({ queryKey: [config.endpoint] });
    }
    setShowImportModal(false);
  };

  // Bulk upload functions
  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkUploadFile(file);
      setBulkUploadProgress({ uploading: false, results: null });
    }
  };

  const processBulkUpload = async () => {
    if (!bulkUploadFile) return;

    setBulkUploadProgress({ uploading: true, results: null });

    try {
      // Parse CSV/Excel file
      const text = await bulkUploadFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File must contain at least header and one data row');
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['kodegudang', 'kodeitem', 'qty'];
      
      for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
          throw new Error(`Missing required column: ${required}`);
        }
      }

      // Parse data rows
      const stockData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === 0 || !values[0]) continue;

        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });

        // Map to expected field names
        stockData.push({
          kodeGudang: record.kodegudang,
          kodeItem: record.kodeitem,
          namaItem: record.namaitem || record.kodeitem,
          qty: parseInt(record.qty) || 0,
          sn: record.sn || null
        });
      }

      // Send to backend
      const response = await apiRequest('POST', '/api/admin/bulk-stock-upload', { stockData });
      const data = await response.json();
      
      setBulkUploadProgress({ 
        uploading: false, 
        results: data.results 
      });

      toast({
        title: "Success",
        description: data.message || "Bulk stock upload completed",
      });

      // Clear file input
      setBulkUploadFile(null);
      const fileInput = document.getElementById('bulk-upload-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Bulk upload error:', error);
      setBulkUploadProgress({ uploading: false, results: null });
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to process bulk upload",
        variant: "destructive",
      });
    }
  };

  // Render field value based on field type  
  const renderFieldValue = useCallback((value: any, field: TableConfig['fields'][0]) => {
    // Handle null/undefined values
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">N/A</span>;
    }

    switch (field.type) {
      case 'checkbox':
        return (
          <Badge 
            variant={value ? "default" : "secondary"} 
            className={`text-xs ${value ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}`}
          >
            {value ? "✓ Yes" : "✗ No"}
          </Badge>
        );
      
      case 'password':
        return (
          <span className="text-gray-500 italic font-mono">
            ••••••••
          </span>
        );
      
      case 'date':
        if (typeof value === 'string' || value instanceof Date) {
          try {
            const date = new Date(value);
            return date.toLocaleDateString();
          } catch {
            return value;
          }
        }
        return value;
      
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      
      default:
        // Handle objects
        if (typeof value === 'object' && value !== null) {
          // If it's an array, join with commas
          if (Array.isArray(value)) {
            return value.join(', ');
          }
          // For other objects, try to display in a readable format
          return (
            <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
              {JSON.stringify(value, null, 2)}
            </span>
          );
        }
        
        // Regular string/text values
        return value?.toString() || 'N/A';
    }
  }, []);

  const renderTableContent = useCallback((config: TableConfig) => {
    // Get the appropriate query data based on table name
    let queryResult;
    switch (config.name) {
      case 'stores':
        queryResult = storesQuery;
        break;
      case 'positions':
        queryResult = positionsQuery;
        break;
      case 'staff':
        queryResult = staffQuery;
        break;
      default:
        queryResult = { data: null, isLoading: false, error: null };
    }

    const { data: rawData, isLoading, error } = queryResult;
    
    // Check for unauthorized error BEFORE any hooks
    if (error && isUnauthorizedError(error)) {
      console.error("Unauthorized access detected:", error);
      return (
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">Unauthorized access. Please log in again.</p>
          <button 
            onClick={() => window.location.replace("/api/login")}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
      );
    }
    
    // Handle both paginated and non-paginated data safely
    let actualData: any[] = [];
    
    if (rawData) {
      if (Array.isArray(rawData)) {
        // Direct array response (non-paginated)
        actualData = rawData;
      } else if (rawData.data && Array.isArray(rawData.data)) {
        // Paginated response with data property
        actualData = rawData.data;
      }
    }
    
    // Filter data based on debounced search query (ignore search for all-store users)
    const searchQuery = shouldUseGlobalStore ? '' : (debouncedSearchQueries[config.name] || '');
    
    // Memoize the filtered data to prevent unnecessary recalculations
    const filteredData = useMemo(() => {
      if (!actualData.length) return [];
      
      if (!searchQuery) return actualData;
      
      const query = searchQuery.toLowerCase();
      return actualData.filter((item: any) => {
        // Search across only the first 3 text fields for performance
        return config.fields.slice(0, 3).some(field => {
          const value = item[field.key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }, [actualData, searchQuery, config.fields]);
    
    // Virtual rendering: only show first maxDisplayItems to prevent DOM overload
    const data = useMemo(() => {
      return filteredData.slice(0, maxDisplayItems);
    }, [filteredData, maxDisplayItems]);
    
    const remainingCount = Math.max(0, filteredData.length - maxDisplayItems);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {config.displayName}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage {config.displayName.toLowerCase()} records
            </p>
            {selectedItems.size > 0 && (
              <Badge variant="secondary" className="mt-2">
                {selectedItems.size} selected
              </Badge>
            )}
          </div>
          <div className="flex space-x-2">
            {selectedItems.size > 0 && (
              <Button
                onClick={() => handleBulkDelete(config)}
                variant="destructive"
                size="sm"
                data-testid={`button-delete-selected-${config.name}`}
              >
                Delete Selected ({selectedItems.size})
              </Button>
            )}
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              data-testid={`button-import-${config.name}`}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV/Excel
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormData({});
                setShowCreateModal(true);
              }}
              data-testid={`button-create-${config.name}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>

        {/* Search and Import Progress */}
        <div className="space-y-4 mb-6">
          {/* Hide search for users with all-store permission */}
          {!shouldUseGlobalStore && (
            <SearchInput
              placeholder={`Search ${config.displayName.toLowerCase()}...`}
              onSearch={(query) => {
                setSearchQueries(prev => ({ ...prev, [config.name]: query }));
              }}
              className="max-w-md"
              data-testid={`search-${config.name}`}
            />
          )}
          
          {currentImportId && isImporting && (
            <ImportProgress
              importId={currentImportId}
              onComplete={() => {
                setIsImporting(false);
                setCurrentImportId(null);
                queryClient.invalidateQueries({ queryKey: [config.endpoint] });
                toast({
                  title: "Import Complete",
                  description: `${config.displayName} data imported successfully!`,
                });
              }}
            />
          )}
        </div>

        <Card className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.isArray(data) && data.length > 0 ? (
                  <div className="space-y-4">
                    {/* Select All Header */}
                    <div className="flex items-center space-x-2 p-3 bg-white/10 dark:bg-black/10 rounded-lg">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={(checked) => handleSelectAll(!!checked, data, config)}
                        data-testid={`checkbox-select-all-${config.name}`}
                      />
                      <Label className="text-sm font-medium">
                        Select All ({data.length} items)
                      </Label>
                    </div>
                    
                    <div className="grid gap-4">
                      {data.map((item: any, index: number) => {
                        const itemId = item[config.keyField] || index;
                        const isSelected = selectedItems.has(itemId);
                        
                        return (
                          <div key={itemId} className={`p-4 rounded-lg transition-colors ${
                            isSelected 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' 
                              : 'bg-white/5 dark:bg-black/5 border border-transparent'
                          }`}>
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectItem(itemId, !!checked)}
                                data-testid={`checkbox-select-${config.name}-${itemId}`}
                                className="mt-1"
                              />
                              <div className="flex justify-between items-start flex-1">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                                  {config.fields.slice(0, 6).map((field) => (
                                    <div key={field.key}>
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {field.label}:
                                      </span>
                                      <div className="text-gray-900 dark:text-white break-words">
                                        {renderFieldValue(item[field.key], field)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex space-x-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(item[config.keyField]);
                                      setFormData(item);
                                      setShowEditModal(true);
                                    }}
                                    data-testid={`button-edit-${item[config.keyField]}`}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(config.endpoint, item[config.keyField], item[config.fields[0]?.key] || item[config.keyField])}
                                    data-testid={`button-delete-${item[config.keyField]}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Show message if there are more items */}
                    {remainingCount > 0 && (
                      <div className="text-center py-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                          <strong>Performance Mode:</strong> Showing first {data.length} items. 
                          {remainingCount} more items available. Use search to narrow results.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No records found</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }, [selectedItems, searchQueries, storesQuery, positionsQuery, staffQuery, handleSelectAll, handleSelectItem]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-950">
      <Sidebar />
      
      <div className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Admin Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage system settings, master data, and user permissions
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-4 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
                <TabsTrigger value="stores" data-testid="tab-stores">Stores</TabsTrigger>
                <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
                <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
                <TabsTrigger value="bulk-upload" data-testid="tab-bulk-upload">Bulk Stock Upload</TabsTrigger>
              </TabsList>

              {tableConfigs.map((config) => (
                <TabsContent key={config.name} value={config.name} className="mt-6">
                  {/* Only render content for active tab for better performance */}
                  {config.name === activeTab ? renderTableContent(config) : (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-gray-500 dark:text-gray-400">Click to load {config.displayName} data</p>
                    </div>
                  )}
                </TabsContent>
              ))}
              
              {/* Bulk Stock Upload Tab */}
              <TabsContent value="bulk-upload" className="mt-6">
                {activeTab === 'bulk-upload' ? (
                  <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <Upload className="w-5 h-5" />
                        Bulk Stock Upload
                      </CardTitle>
                      <p className="text-gray-600 dark:text-gray-400">
                        Upload stock data for all stores at once. This creates transfer orders from a system store to populate initial inventory.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* File Format Instructions */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                          📄 Required File Format (CSV/Excel)
                        </h4>
                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                          <p><strong>Required Columns:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li><strong>kodeGudang:</strong> Store code (must exist in system)</li>
                            <li><strong>kodeItem:</strong> Item code</li>
                            <li><strong>namaItem:</strong> Item name (optional, will use kodeItem if not provided)</li>
                            <li><strong>qty:</strong> Quantity (must be greater than 0)</li>
                            <li><strong>sn:</strong> Serial number (optional)</li>
                          </ul>
                          <p className="mt-3"><strong>Example:</strong></p>
                          <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs">
                            kodeGudang,kodeItem,namaItem,qty,sn<br/>
                            B-CGI,ITEM001,Sample Item 1,10,SN001<br/>
                            B-CGI,ITEM002,Sample Item 2,5,<br/>
                            B-C.SC,ITEM001,Sample Item 1,15,SN002
                          </div>
                        </div>
                      </div>

                      {/* File Upload */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="bulk-upload-file">Upload Stock File</Label>
                          <Input
                            id="bulk-upload-file"
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleBulkFileChange}
                            disabled={bulkUploadProgress.uploading}
                            data-testid="input-bulk-upload-file"
                          />
                        </div>

                        {bulkUploadFile && (
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {bulkUploadFile.name} ({(bulkUploadFile.size / 1024).toFixed(1)} KB)
                            </span>
                            <Button
                              size="sm"
                              onClick={processBulkUpload}
                              disabled={bulkUploadProgress.uploading}
                              data-testid="button-process-upload"
                            >
                              {bulkUploadProgress.uploading ? 'Processing...' : 'Process Upload'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Progress and Results */}
                      {bulkUploadProgress.results && (
                        <div className="space-y-4">
                          <div className={`p-4 rounded-lg ${
                            bulkUploadProgress.results.errors.length === 0 
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                          }`}>
                            <h4 className="font-medium mb-2">Upload Results</h4>
                            <div className="text-sm space-y-1">
                              <p>✅ Processed: {bulkUploadProgress.results.processed} records</p>
                              <p>✅ Created: {bulkUploadProgress.results.created} transfer orders</p>
                              {bulkUploadProgress.results.errors.length > 0 && (
                                <p className="text-red-600 dark:text-red-400">
                                  ❌ Errors: {bulkUploadProgress.results.errors.length}
                                </p>
                              )}
                            </div>
                          </div>

                          {bulkUploadProgress.results.errors.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                              <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors</h4>
                              <div className="text-sm text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                                {bulkUploadProgress.results.errors.map((error: any, index: number) => (
                                  <p key={index}>Row {error.row}: {error.error}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Warning */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Notes</h4>
                        <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                          <p>• This action creates transfer orders from a SYSTEM store to populate initial inventory</p>
                          <p>• Make sure all store codes in your file exist in the system</p>
                          <p>• This is typically used for initial stock setup or bulk inventory adjustments</p>
                          <p>• Review the transfer orders in the Transfers page after upload</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-gray-500 dark:text-gray-400">Click to load Bulk Stock Upload</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setEditingItem(null);
          setFormData({});
          setShowPassword(false); // Reset password visibility when modal closes
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Update' : 'Create'} {getCurrentConfig()?.displayName} Record
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {getCurrentConfig()?.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>
                  {field.label} {field.required && '*'}
                </Label>
                {field.type === 'select' ? (
                  <Select 
                    value={formData[field.key] || ''} 
                    onValueChange={(value) => setFormData({ ...formData, [field.key]: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={Boolean(formData[field.key]) && formData[field.key] !== 'false'}
                      onCheckedChange={(checked) => setFormData({ ...formData, [field.key]: checked ? 'true' : 'false' })}
                      data-testid={`checkbox-${field.key}`}
                    />
                    <label htmlFor={field.key} className="text-sm text-gray-600 dark:text-gray-400">
                      Enable {field.label}
                    </label>
                  </div>
                ) : field.type === 'password' ? (
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={showPassword ? 'text' : 'password'}
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      required={field.required}
                      data-testid={`input-${field.key}`}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    required={field.required}
                    data-testid={`input-${field.key}`}
                  />
                )}
              </div>
            ))}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingItem(null);
                  setFormData({});
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-form"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? 'Saving...' 
                  : editingItem ? 'Update' : 'Create'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={`Import ${getCurrentConfig()?.displayName || 'Data'}`}
        tableName={getCurrentConfig()?.importTable || ''}
        queryKey={getCurrentConfig()?.endpoint || ''}
        endpoint="/api/import"
        acceptedFormats=".csv,.xlsx,.xls"
        sampleData={getCurrentConfig()?.fields.map(f => f.label) || []}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300">
              Are you sure you want to delete {selectedItems.size} selected {selectedItems.size === 1 ? 'item' : 'items'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="border-gray-300 dark:border-gray-600"
              data-testid="button-cancel-bulk-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-bulk-delete"
            >
              Delete {selectedItems.size} {selectedItems.size === 1 ? 'Item' : 'Items'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Individual Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Item</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300">
              Are you sure you want to delete {deletingItem?.name ? `"${deletingItem.name}"` : 'this item'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeletingItem(null)}
              className="border-gray-300 dark:border-gray-600"
              data-testid="button-cancel-delete-item"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-item"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}