import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const roleDescriptions = {
  'SPG': 'Can input sales and settlements (cannot view reconciliation results)',
  'Supervisor': 'Can input sales, create/check settlements, insert transfer orders, update opening stock, update pricelist and discounts, view dashboards',
  'Stockist': 'Can insert transfer orders, update opening stock, update reference sheet & stores, view stock ledger and dashboards',
  'Sales Administrator': 'Can view/verify all settlements & sales, view dashboards, access pricelist & discounts',
  'Finance': 'Can manage payment methods, view all settlements & sales, view sales dashboard',
  'System Administrator': 'Full access to all features and user management'
};

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');

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
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.roles.includes(roleFilter);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage user accounts and role assignments</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50"
                data-testid="button-export-users"
              >
                <i className="fas fa-download mr-2"></i>
                Export
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                data-testid="button-add-user"
              >
                <i className="fas fa-plus mr-2"></i>
                Add User
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Role Information Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
            {Object.entries(roleDescriptions).map(([role, description]) => (
              <Card key={role} className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">{role}</CardTitle>
                    <Badge className={`${getRoleBadgeColor(role)} border-0`}>
                      {mockUsers.filter(u => u.roles.includes(role)).length} users
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Users
                  </label>
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-users"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Role
                  </label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger data-testid="select-role-filter">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Roles</SelectItem>
                      {Object.keys(roleDescriptions).map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="button-reset-filters"
                    onClick={() => {
                      setSearchTerm('');
                      setRoleFilter('');
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                System Users
                <span className="ml-2 text-sm text-gray-500">({filteredUsers.length} users)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredUsers.length > 0 ? (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                      data-testid={`card-user-${user.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            {user.roles.map((role) => (
                              <Badge key={role} className={`${getRoleBadgeColor(role)} border-0 text-xs`}>
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className={`${getStatusColor(user.status)} border-0`}>
                            {user.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last login: {user.lastLogin}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-users text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {searchTerm || roleFilter ? 'No matching users' : 'No users found'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchTerm || roleFilter 
                      ? 'No users match your search criteria.' 
                      : 'Start by adding users to the system.'}
                  </p>
                  <Button
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    data-testid="button-add-first-user"
                  >
                    Add First User
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
