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
import { Sidebar } from "@/components/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    name: 'discounts',
    displayName: 'Discount Types',
    endpoint: '/api/discounts',
    importTable: 'discounts',
    keyField: 'discountId',
    fields: [
      { key: 'namaDiscount', label: 'Discount Name', type: 'text', required: true },
      { key: 'persentaseDiscount', label: 'Discount Percentage', type: 'number', required: true },
      { key: 'tglMulai', label: 'Start Date', type: 'date' },
      { key: 'tglSelesai', label: 'End Date', type: 'date' },
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
      { key: 'kodeEdc', label: 'EDC Code', type: 'text', required: true },
      { key: 'provider', label: 'Provider', type: 'text' },
      { key: 'merchantId', label: 'Merchant ID', type: 'text' },
    ]
  },
];

const roleDescriptions = {
  'SPG': 'Can input sales and settlements (cannot view reconciliation results)',
  'Supervisor': 'Can input sales, create/check settlements, insert transfer orders, update opening stock, update pricelist and discounts, view dashboards',
  'Stockist': 'Can insert transfer orders, update opening stock, update reference sheet & stores, view stock ledger and dashboards',
  'Sales Administrator': 'Can view/verify all settlements & sales, view dashboards, access pricelist & discounts',
  'Finance': 'Can manage payment methods, view all settlements & sales, view sales dashboard',
  'System Administrator': 'Full access to all features and user management'
};

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('reference-sheet');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // User Management State
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is System Administrator
  const isSystemAdmin = true; // For now, hardcoded - in real app: user?.role === 'System Administrator'

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <Card className="w-96 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">You must be a System Administrator to access Admin Settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getCurrentConfig = () => {
    return tableConfigs.find(config => config.name === activeTab);
  };

  const useTableData = (endpoint: string) => {
    return useQuery({
      queryKey: [endpoint],
      retry: false,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const config = getCurrentConfig();
      if (!config) throw new Error('Invalid table configuration');
      
      return await apiRequest(`${config.endpoint}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
      if (isUnauthorizedError(error)) {
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
        title: "Error",
        description: "Failed to create record",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
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
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              data-testid={`button-import-${config.name}`}
            >
              <i className="fas fa-file-import mr-2"></i>
              Import CSV/Excel
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              data-testid={`button-create-${config.name}`}
            >
              <i className="fas fa-plus mr-2"></i>
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
                {data && data.length > 0 ? (
                  <div className="grid gap-4">
                    {data.map((item: any, index: number) => (
                      <div key={item[config.keyField] || index} className="p-4 bg-white/5 dark:bg-black/5 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                            {config.fields.slice(0, 6).map((field) => (
                              <div key={field.key}>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {field.label}:
                                </span>
                                <p className="text-gray-900 dark:text-white mt-1">
                                  {item[field.key] || '-'}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" data-testid={`button-edit-${item[config.keyField]}`}>
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`button-delete-${item[config.keyField]}`}>
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
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

  const renderUserManagement = () => {
    // Mock user data - in real app this would come from API
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', roles: ['Supervisor'], status: 'Active', lastLogin: '2024-01-15' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', roles: ['SPG'], status: 'Active', lastLogin: '2024-01-14' },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', roles: ['Stockist'], status: 'Inactive', lastLogin: '2024-01-10' },
      { id: 4, name: 'Alice Johnson', email: 'alice@example.com', roles: ['Finance'], status: 'Active', lastLogin: '2024-01-15' },
      { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', roles: ['System Administrator'], status: 'Active', lastLogin: '2024-01-15' },
    ];

    // Filter users based on search and role
    const filteredUsers = mockUsers.filter((user) => {
      const matchesSearch = user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
      const matchesRole = !userRoleFilter || user.roles.includes(userRoleFilter);
      return matchesSearch && matchesRole;
    });

    const getRoleBadgeColor = (role: string) => {
      const colors = {
        'SPG': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        'Supervisor': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
        'Stockist': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
        'Sales Administrator': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        'Finance': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
        'System Administrator': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      };
      return colors[role as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    };

    const getStatusColor = (status: string) => {
      return status === 'Active' 
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              User Management
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage user accounts and role assignments
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              data-testid="button-import-users"
            >
              <i className="fas fa-file-import mr-2"></i>
              Import Users
            </Button>
            <Button data-testid="button-add-user">
              <i className="fas fa-plus mr-2"></i>
              Add User
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
          <CardContent className="p-6">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50"
                  data-testid="input-user-search"
                />
              </div>
              <div className="w-48">
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50" data-testid="select-role-filter">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Roles</SelectItem>
                    <SelectItem value="SPG">SPG</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Stockist">Stockist</SelectItem>
                    <SelectItem value="Sales Administrator">Sales Administrator</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="System Administrator">System Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
          <CardContent className="p-6">
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4 bg-white/5 dark:bg-black/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{user.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Last login: {user.lastLogin}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            className={getRoleBadgeColor(role)}
                            data-testid={`badge-role-${role.toLowerCase().replace(' ', '-')}`}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                      <Badge
                        className={getStatusColor(user.status)}
                        data-testid={`badge-status-${user.status.toLowerCase()}`}
                      >
                        {user.status}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Descriptions */}
        <Card className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Role Descriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {Object.entries(roleDescriptions).map(([role, description]) => (
                <div key={role} className="p-3 bg-white/5 dark:bg-black/5 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Badge className={getRoleBadgeColor(role)}>
                      {role}
                    </Badge>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Settings</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system configuration and master data</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
              <TabsTrigger value="reference-sheet" data-testid="tab-reference-sheet">Reference Sheet</TabsTrigger>
              <TabsTrigger value="stores" data-testid="tab-stores">Stores</TabsTrigger>
              <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
              <TabsTrigger value="discounts" data-testid="tab-discounts">Discounts</TabsTrigger>
              <TabsTrigger value="edc" data-testid="tab-edc">EDC</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            </TabsList>

            {tableConfigs.map((config) => (
              <TabsContent key={config.name} value={config.name} className="mt-6">
                {renderTableContent(config)}
              </TabsContent>
            ))}

            <TabsContent value="users" className="mt-6">
              {renderUserManagement()}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-white/20 dark:border-gray-800/50 text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Add New {getCurrentConfig()?.displayName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {getCurrentConfig()?.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key} className="text-gray-700 dark:text-gray-300">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </Label>
                {field.type === 'select' ? (
                  <Select
                    value={formData[field.key] || ''}
                    onValueChange={(value) => setFormData({ ...formData, [field.key]: value })}
                  >
                    <SelectTrigger className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50">
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
                    className="bg-white/5 dark:bg-black/5 border-white/20 dark:border-gray-700/50"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          tableName={getCurrentConfig()?.importTable || activeTab}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}