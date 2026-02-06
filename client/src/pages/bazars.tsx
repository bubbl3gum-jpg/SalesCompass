import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Edit3, Trash2, Plus, Search, Store, Calendar, MapPin, RotateCcw, History, LayoutGrid, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Bazar {
  bazarId: number;
  bazarName: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'ended';
}

interface Settlement {
  settlementId: number;
  bazarId: number | null;
  cashAwal: string;
  cashAkhir: string;
  variance: string;
}

interface EdcSettlement {
  edcSettlementId: number;
  settlementId: number;
  settlementValue: string;
}

interface LocationGroup {
  location: string;
  bazars: Bazar[];
  totalRevenue: number;
}

export default function Bazars() {
  const { user } = useStoreAuth();
  const { isExpanded } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBazar, setEditingBazar] = useState<Bazar | null>(null);
  const [formData, setFormData] = useState({
    bazarName: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'upcoming' as 'upcoming' | 'active' | 'ended'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingBazar, setDeletingBazar] = useState<Bazar | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'history'>('grid');

  const isAdmin = user?.role === 'System Administrator';

  const { data: bazars, isLoading, error } = useQuery({
    queryKey: ['/api/bazars'],
    retry: false,
  });

  const { data: settlements } = useQuery<Settlement[]>({
    queryKey: ['/api/settlements'],
    retry: false,
  });

  const bazarSettlementIds = useMemo(() => {
    if (!settlements) return '';
    return settlements.filter(s => s.bazarId).map(s => s.settlementId).join(',');
  }, [settlements]);

  const { data: edcSettlements = [] } = useQuery<EdcSettlement[]>({
    queryKey: ['/api/edc-settlements', { settlement_ids: bazarSettlementIds }],
    queryFn: async () => {
      if (!bazarSettlementIds) return [];
      const response = await fetch(`/api/edc-settlements?settlement_ids=${bazarSettlementIds}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!bazarSettlementIds,
    retry: false,
  });

  const edcTotalsBySettlement = useMemo(() => {
    const map = new Map<number, number>();
    edcSettlements.forEach(edc => {
      const current = map.get(edc.settlementId) || 0;
      map.set(edc.settlementId, current + parseFloat(edc.settlementValue || '0'));
    });
    return map;
  }, [edcSettlements]);

  const filteredBazars = Array.isArray(bazars) ? bazars.filter((bazar: Bazar) =>
    bazar.bazarName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bazar.location?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const getBazarRevenue = (bazarId: number): number => {
    if (!settlements) return 0;
    return settlements
      .filter(s => s.bazarId === bazarId)
      .reduce((total, s) => {
        const cashRevenue = parseFloat(s.cashAkhir || '0') - parseFloat(s.cashAwal || '0');
        const edcRevenue = edcTotalsBySettlement.get(s.settlementId) || 0;
        return total + cashRevenue + edcRevenue;
      }, 0);
  };

  const locationGroups: LocationGroup[] = (() => {
    if (!Array.isArray(bazars)) return [];
    const groups = new Map<string, Bazar[]>();
    
    filteredBazars.forEach((bazar: Bazar) => {
      const existing = groups.get(bazar.location) || [];
      groups.set(bazar.location, [...existing, bazar]);
    });

    return Array.from(groups.entries()).map(([location, locationBazars]) => ({
      location,
      bazars: locationBazars.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
      totalRevenue: locationBazars.reduce((sum, b) => sum + getBazarRevenue(b.bazarId), 0),
    }));
  })();

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Bazar>) => {
      const response = await apiRequest('POST', '/api/bazars', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bazars'] });
      setShowCreateModal(false);
      setFormData({ bazarName: '', location: '', startDate: '', endDate: '', status: 'upcoming' });
      toast({
        title: "Success",
        description: "Bazar created successfully",
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
        title: "Create Failed",
        description: (error as Error).message || "Failed to create bazar",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Bazar> }) => {
      const response = await apiRequest('PUT', `/api/bazars/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bazars'] });
      setShowEditModal(false);
      setEditingBazar(null);
      setFormData({ bazarName: '', location: '', startDate: '', endDate: '', status: 'upcoming' });
      toast({
        title: "Success",
        description: "Bazar updated successfully",
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
        description: (error as Error).message || "Failed to update bazar",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/bazars/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bazars'] });
      setDeletingBazar(null);
      toast({
        title: "Success",
        description: "Bazar deleted successfully",
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
        description: (error as Error).message || "Failed to delete bazar",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      bazarName: formData.bazarName,
      location: formData.location,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: formData.status,
    };

    if (editingBazar) {
      updateMutation.mutate({ id: editingBazar.bazarId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (bazar: Bazar) => {
    setEditingBazar(bazar);
    setFormData({
      bazarName: bazar.bazarName || '',
      location: bazar.location || '',
      startDate: bazar.startDate ? bazar.startDate.split('T')[0] : '',
      endDate: bazar.endDate ? bazar.endDate.split('T')[0] : '',
      status: bazar.status || 'upcoming',
    });
    setShowEditModal(true);
  };

  const handleOpenCreate = () => {
    setFormData({ bazarName: '', location: '', startDate: '', endDate: '', status: 'upcoming' });
    setShowCreateModal(true);
  };

  const handleRepeatBazar = (bazar: Bazar) => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      bazarName: bazar.bazarName,
      location: bazar.location,
      startDate: today,
      endDate: nextWeek,
      status: 'upcoming',
    });
    setShowCreateModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Upcoming</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
      case 'ended':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Ended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className={cn(
        "flex-1 transition-all duration-200",
        isExpanded ? "ml-64" : "ml-16"
      )}>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Bazar Management</h1>
            <p className="text-gray-600">Manage bazar events, locations, and schedules</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Bazars ({filteredBazars.length})
                </CardTitle>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="rounded-none"
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Grid
                    </Button>
                    <Button
                      variant={viewMode === 'history' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('history')}
                      className="rounded-none"
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                  </div>
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search bazars..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  {isAdmin && (
                    <Button onClick={handleOpenCreate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Bazar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : filteredBazars.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery ? 'No bazars found matching your search' : 'No bazars created yet'}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBazars.map((bazar: Bazar) => (
                    <Card key={bazar.bazarId} className="relative hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                            {bazar.bazarName}
                          </h3>
                          {getStatusBadge(bazar.status)}
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="line-clamp-1">{bazar.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(bazar.startDate)} - {formatDate(bazar.endDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-medium text-green-600">{formatCurrency(getBazarRevenue(bazar.bazarId))}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 mt-4 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(bazar)}
                              className="flex-1"
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            {bazar.status === 'ended' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRepeatBazar(bazar)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Create new bazar at this location"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingBazar(bazar)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {locationGroups.map((group) => (
                    <Card key={group.location} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="h-5 w-5 text-blue-600" />
                              <h3 className="font-semibold text-lg text-gray-900">{group.location}</h3>
                            </div>
                            <p className="text-sm text-gray-500">
                              {group.bazars.length} event{group.bazars.length !== 1 ? 's' : ''} at this location
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Total Revenue</p>
                            <p className="font-bold text-lg text-green-600">{formatCurrency(group.totalRevenue)}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {group.bazars.map((bazar) => (
                            <div
                              key={bazar.bazarId}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border",
                                bazar.status === 'active' ? 'bg-green-50 border-green-200' :
                                bazar.status === 'upcoming' ? 'bg-blue-50 border-blue-200' :
                                'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{bazar.bazarName}</span>
                                    {getStatusBadge(bazar.status)}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(bazar.startDate)} - {formatDate(bazar.endDate)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Revenue</p>
                                  <p className="font-medium text-green-600">{formatCurrency(getBazarRevenue(bazar.bazarId))}</p>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(bazar)}
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                    {bazar.status === 'ended' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRepeatBazar(bazar)}
                                        className="text-blue-600"
                                        title="Repeat this bazar"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Bazar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="bazarName">Bazar Name *</Label>
              <Input
                id="bazarName"
                value={formData.bazarName}
                onChange={(e) => setFormData({ ...formData, bazarName: e.target.value })}
                placeholder="Enter bazar name"
                required
              />
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Bazar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bazar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="editBazarName">Bazar Name *</Label>
              <Input
                id="editBazarName"
                value={formData.bazarName}
                onChange={(e) => setFormData({ ...formData, bazarName: e.target.value })}
                placeholder="Enter bazar name"
                required
              />
            </div>
            <div>
              <Label htmlFor="editLocation">Location *</Label>
              <Input
                id="editLocation"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editStartDate">Start Date *</Label>
                <Input
                  id="editStartDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editEndDate">End Date *</Label>
                <Input
                  id="editEndDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editStatus">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingBazar} onOpenChange={(open) => !open && setDeletingBazar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bazar?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingBazar?.bazarName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBazar && deleteMutation.mutate(deletingBazar.bazarId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
