import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
    name: 'reference-sheet',
    displayName: 'Reference Sheet (Items Master)',
    endpoint: '/api/reference-sheets',
    importTable: 'reference-sheet',
    keyField: 'refId',
    fields: [
      { key: 'kodeItem', label: 'Item Code', type: 'text', required: true },
      { key: 'namaItem', label: 'Item Name', type: 'text', required: true },
      { key: 'kelompok', label: 'Group', type: 'text' },
      { key: 'family', label: 'Family', type: 'text' },
      { key: 'originalCode', label: 'Original Code', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'kodeMaterial', label: 'Material Code', type: 'text' },
      { key: 'deskripsiMaterial', label: 'Material Description', type: 'text' },
      { key: 'kodeMotif', label: 'Motif Code', type: 'text' },
      { key: 'deskripsiMotif', label: 'Motif Description', type: 'text' },
    ]
  },
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
      { key: 'canAccessDiscounts', label: 'Discounts Access', type: 'checkbox' },
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
  },
  {
    name: 'edc',
    displayName: 'EDC / Payment Methods',
    endpoint: '/api/edc',
    importTable: 'edc',
    keyField: 'edcId',
    fields: [
      { key: 'namaEdc', label: 'EDC Name', type: 'text', required: true },
      { key: 'jenisEdc', label: 'EDC Type', type: 'text', required: true },
      { key: 'biayaAdmin', label: 'Admin Fee', type: 'number' },
    ]
  }
];

function useTableData(endpoint: string, enabled = true) {
  return useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    enabled, // Only fetch when enabled is true
  });
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { isExpanded } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('reference-sheet');

  // Fetch positions for staff form - only when needed
  const { data: positions = [] } = useQuery({
    queryKey: ['/api/positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    enabled: activeTab === 'staff' || activeTab === 'positions',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // Data Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Search and Import Progress State
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{endpoint: string, id: string, name?: string} | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      if (jabatanField) {
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
          window.location.href = "/api/login";
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
          window.location.href = "/api/login";
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
          window.location.href = "/api/login";
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

  const renderTableContent = (config: TableConfig) => {
    // Only fetch data for the active tab
    const isActiveTab = config.name === activeTab;
    const { data: rawData, isLoading, error } = useTableData(config.endpoint, isActiveTab);
    
    // Filter data based on search query
    const searchQuery = searchQueries[config.name] || '';
    const data = rawData ? rawData.filter((item: any) => {
      if (!searchQuery) return true;
      
      // Search across all text fields
      return config.fields.some(field => {
        const value = item[field.key];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return false;
      });
    }) : [];

    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return null;
    }

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
          <SearchInput
            placeholder={`Search ${config.displayName.toLowerCase()}...`}
            onSearch={(query) => {
              setSearchQueries(prev => ({ ...prev, [config.name]: query }));
            }}
            className="max-w-md"
            data-testid={`search-${config.name}`}
          />
          
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
                                        {typeof item[field.key] === 'object' && item[field.key] !== null 
                                          ? JSON.stringify(item[field.key])
                                          : (item[field.key] || 'N/A')
                                        }
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
                                    onClick={() => handleDelete(config.endpoint, item[config.keyField], item[config.displayField || config.keyField])}
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
  };

  if (!user) {
    return <div>Please log in to access admin settings.</div>;
  }

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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
                <TabsTrigger value="reference-sheet" data-testid="tab-reference-sheet">Reference Sheet</TabsTrigger>
                <TabsTrigger value="stores" data-testid="tab-stores">Stores</TabsTrigger>
                <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
                <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
                <TabsTrigger value="discounts" data-testid="tab-discounts">Discounts</TabsTrigger>
                <TabsTrigger value="edc" data-testid="tab-edc">EDC</TabsTrigger>
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
                      checked={formData[field.key] === 'true' || formData[field.key] === true}
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