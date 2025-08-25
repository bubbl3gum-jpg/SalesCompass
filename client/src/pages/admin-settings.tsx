import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
import { ImportModal } from "@/components/import-modal";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit3, Trash2, Plus, Upload } from "lucide-react";

interface TableConfig {
  name: string;
  displayName: string;
  endpoint: string;
  importTable: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
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
    ]
  },
  {
    name: 'staff',
    displayName: 'Staff',
    endpoint: '/api/staff',
    importTable: 'staff',
    keyField: 'employeeId',
    fields: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'namaLengkap', label: 'Full Name', type: 'text', required: true },
      { key: 'kota', label: 'City', type: 'text' },
      { key: 'alamat', label: 'Address', type: 'text' },
      { key: 'noHp', label: 'Phone Number', type: 'text' },
      { key: 'tempatLahir', label: 'Place of Birth', type: 'text' },
      { key: 'tanggalLahir', label: 'Date of Birth', type: 'date' },
      { key: 'tanggalMasuk', label: 'Date Joined', type: 'date' },
      { key: 'jabatan', label: 'Position', type: 'select', required: true, options: [] },
    ]
  },
  {
    name: 'discounts',
    displayName: 'Discount Types',
    endpoint: '/api/discounts',
    importTable: 'discounts',
    keyField: 'discountId',
    fields: [
      { key: 'namaDiscount', label: 'Discount Name', type: 'text', required: true },
      { key: 'jenisDiscount', label: 'Discount Type', type: 'select', required: true, options: [
        { value: 'percentage', label: 'Percentage' },
        { value: 'amount', label: 'Fixed Amount' }
      ] },
      { key: 'nilaiDiscount', label: 'Discount Value', type: 'number', required: true },
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

function useTableData(endpoint: string) {
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
  });
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch positions for staff form  
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
  });

  const [activeTab, setActiveTab] = useState('reference-sheet');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // Data Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Selection handlers
  const handleSelectAll = (checked: boolean, data: any[], config: TableConfig) => {
    if (checked) {
      const allIds = new Set(data.map(item => item[config.keyField]));
      setSelectedItems(allIds);
      setSelectAll(true);
    } else {
      setSelectedItems(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
      setSelectAll(false);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = async (config: TableConfig) => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select items to delete",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const itemId of Array.from(selectedItems)) {
        await apiRequest('DELETE', `${config.endpoint}/${itemId}`);
      }
      
      queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      setSelectedItems(new Set());
      setSelectAll(false);
      
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

  const getCurrentConfig = () => {
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
  };

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
        queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      }
      
      setShowEditModal(false);
      setEditingItem(null);
      setFormData({});
      
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

  const handleDelete = (endpoint: string, id: string) => {
    deleteMutation.mutate({ endpoint, id });
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
    const { data, isLoading, error } = useTableData(config.endpoint);

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
              onClick={() => setShowCreateModal(true)}
              data-testid={`button-create-${config.name}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
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
                                      setFormData(item);
                                      setShowEditModal(true);
                                      setEditingItem(item[config.keyField]);
                                    }}
                                    data-testid={`button-edit-${item[config.keyField]}`}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(config.endpoint, item[config.keyField])}
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
      
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
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
                  {renderTableContent(config)}
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
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit' : 'Create'} {getCurrentConfig()?.displayName} Record
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
    </div>
  );
}