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
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImportModal } from "@/components/import-modal";
import { apiRequest } from "@/lib/queryClient";

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
    name: 'staff',
    displayName: 'Staff',
    endpoint: '/api/staff',
    importTable: 'staff',
    keyField: 'staffId',
    fields: [
      { key: 'namaStaff', label: 'Staff Name', type: 'text', required: true },
      { key: 'posisi', label: 'Position', type: 'text', required: true },
      { key: 'kodeGudang', label: 'Store Code', type: 'text', required: true },
      { key: 'tanggalMasuk', label: 'Join Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]},
    ]
  },
  {
    name: 'discount-types',
    displayName: 'Discount Types',
    endpoint: '/api/discounts',
    importTable: 'discounts',
    keyField: 'discountId',
    fields: [
      { key: 'discountType', label: 'Discount Type', type: 'text', required: true },
      { key: 'startFrom', label: 'Start Date', type: 'date' },
      { key: 'endAt', label: 'End Date', type: 'date' },
    ]
  },
  {
    name: 'edc',
    displayName: 'EDC',
    endpoint: '/api/edc',
    importTable: 'edc',
    keyField: 'edcId',
    fields: [
      { key: 'namaEdc', label: 'EDC Name', type: 'text', required: true },
      { key: 'jenisEdc', label: 'EDC Type', type: 'text' },
    ]
  }
];

export default function AdminPanel() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedTable, setSelectedTable] = useState(tableConfigs[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Redirect non-admin users
  if (isAuthenticated && user?.role !== 'System Administrator') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Only System Administrators can access the Admin Panel.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get data for selected table
  const { data: tableData, isLoading, refetch } = useQuery({
    queryKey: [selectedTable.endpoint],
    retry: false,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = selectedTable.endpoint.replace('/api/', '/api/') + (selectedTable.name === 'staff' ? '' : '');
      return await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: `${selectedTable.displayName} created successfully` });
      setShowCreateModal(false);
      setFormData({});
      refetch();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: `Failed to create ${selectedTable.displayName}`, variant: "destructive" });
    },
  });

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleCreate = () => {
    // Validate required fields
    const missingFields = selectedTable.fields
      .filter(field => field.required && !formData[field.key])
      .map(field => field.label);
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in required fields: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-white/20 dark:border-gray-800/50 bg-white/30 dark:bg-black/30 backdrop-blur-xl">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                <i className="fas fa-cogs mr-3 text-blue-600"></i>
                Admin Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage all master data tables and system configuration
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                System Administrator
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Master Data Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTable.name} onValueChange={(value) => {
              const table = tableConfigs.find(t => t.name === value);
              if (table) setSelectedTable(table);
            }}>
              <TabsList className="grid grid-cols-5 w-full mb-6">
                {tableConfigs.map((table) => (
                  <TabsTrigger key={table.name} value={table.name} className="text-xs">
                    {table.displayName.split(' ')[0]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tableConfigs.map((table) => (
                <TabsContent key={table.name} value={table.name} className="space-y-4">
                  {/* Table Actions */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {table.displayName}
                    </h3>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setShowImportModal(true)}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        data-testid={`button-import-${table.name}`}
                      >
                        <i className="fas fa-upload mr-2"></i>
                        Import CSV/Excel
                      </Button>
                      
                      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                        <DialogTrigger asChild>
                          <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            data-testid={`button-create-${table.name}`}
                          >
                            <i className="fas fa-plus mr-2"></i>
                            Add New
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-gray-900 dark:text-white">
                              Create New {table.displayName}
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-4 max-h-96 overflow-y-auto">
                            {table.fields.map((field) => (
                              <div key={field.key}>
                                <Label htmlFor={field.key} className="text-gray-700 dark:text-gray-300">
                                  {field.label} {field.required && <span className="text-red-500">*</span>}
                                </Label>
                                
                                {field.type === 'select' ? (
                                  <select
                                    id={field.key}
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md"
                                    data-testid={`input-${field.key}`}
                                  >
                                    <option value="">Select {field.label}</option>
                                    {field.options?.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <Input
                                    id={field.key}
                                    type={field.type}
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                    data-testid={`input-${field.key}`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowCreateModal(false);
                                setFormData({});
                              }}
                              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                              data-testid="button-cancel-create"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleCreate}
                              disabled={createMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              data-testid="button-save-create"
                            >
                              {createMutation.isPending ? "Creating..." : "Create"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Table Data */}
                  <div className="space-y-3">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                          <div className="flex justify-between items-center">
                            <div className="space-y-2">
                              <Skeleton className="w-40 h-4" />
                              <Skeleton className="w-32 h-3" />
                            </div>
                            <Skeleton className="w-20 h-8" />
                          </div>
                        </div>
                      ))
                    ) : tableData && tableData.length > 0 ? (
                      tableData.map((item: any, index: number) => (
                        <div
                          key={item[table.keyField] || index}
                          className="p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                          data-testid={`row-${table.name}-${index}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              {table.fields.slice(0, 3).map((field) => (
                                <div key={field.key} className="flex">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">
                                    {field.label}:
                                  </span>
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    {item[field.key] || '-'}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                data-testid={`button-edit-${index}`}
                              >
                                <i className="fas fa-edit mr-1"></i>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                data-testid={`button-delete-${index}`}
                              >
                                <i className="fas fa-trash mr-1"></i>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="fas fa-database text-white text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No {table.displayName} Data
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                          No records found. Start by creating new entries or importing data.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={`Import ${selectedTable.displayName}`}
        tableName={selectedTable.importTable}
        queryKey={selectedTable.endpoint}
        endpoint="/api/import"
        acceptedFormats=".csv,.xlsx,.xls"
        sampleData={selectedTable.fields.map(f => f.key)}
      />
    </div>
  );
}