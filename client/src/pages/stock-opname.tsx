import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { ImportModal } from "@/components/import-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { insertStockOpnameSchema, insertSoItemListSchema } from "@shared/schema";
import { z } from "zod";

type InsertStockOpname = z.infer<typeof insertStockOpnameSchema>;
type InsertSoItemList = z.infer<typeof insertSoItemListSchema>;

export default function StockOpname() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form states
  const [newSoDate, setNewSoDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemSn, setItemSn] = useState('');
  const [itemKodeItem, setItemKodeItem] = useState('');
  const [itemNamaItem, setItemNamaItem] = useState('');
  const [itemQty, setItemQty] = useState('');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Get stores
  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get stock opname records
  const { data: stockOpnameList, isLoading: soLoading, error: soError } = useQuery({
    queryKey: ["/api/stock-opname"],
    retry: false,
  });

  // Get opening stock for comparison
  const { data: openingStock, isLoading: openingStockLoading } = useQuery({
    queryKey: ["/api/opening-stock"],
    retry: false,
  });

  useEffect(() => {
    if (soError && isUnauthorizedError(soError as Error)) {
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
  }, [soError, toast]);

  // Set default store when stores load
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].kodeGudang);
    }
  }, [stores, selectedStore]);

  // Create new stock opname
  const createSoMutation = useMutation({
    mutationFn: async (data: InsertStockOpname) => {
      return await apiRequest('/api/stock-opname', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock opname created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-opname"] });
      setShowCreateModal(false);
      setNewSoDate(new Date().toISOString().split('T')[0]);
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
        title: "Error",
        description: "Failed to create stock opname",
        variant: "destructive",
      });
    },
  });

  // Add item to stock opname
  const addItemMutation = useMutation({
    mutationFn: async (data: InsertSoItemList) => {
      return await apiRequest('/api/stock-opname-items', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item added to stock opname successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-opname"] });
      setShowAddItemModal(false);
      setItemSn('');
      setItemKodeItem('');
      setItemNamaItem('');
      setItemQty('');
      setSelectedSoId(null);
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
        title: "Error",
        description: "Failed to add item to stock opname",
        variant: "destructive",
      });
    },
  });

  const handleCreateSo = () => {
    if (!selectedStore || !newSoDate) {
      toast({
        title: "Error",
        description: "Please select store and date",
        variant: "destructive",
      });
      return;
    }

    createSoMutation.mutate({
      kodeGudang: selectedStore,
      tanggal: newSoDate,
    });
  };

  const handleAddItem = () => {
    if (!selectedSoId || !itemKodeItem || !itemQty) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    addItemMutation.mutate({
      soId: selectedSoId,
      sn: itemSn || null,
      kodeItem: itemKodeItem,
      namaItem: itemNamaItem || null,
      qty: parseInt(itemQty),
    });
  };

  // Compare stock opname with opening stock
  const getVariance = (kodeItem: string, soQty: number) => {
    const openingStockItem = openingStock?.find((item: any) => item.kodeItem === kodeItem);
    const systemQty = openingStockItem?.qty || 0;
    return soQty - systemQty;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Top Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Opname</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Physical inventory count and comparison</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Selection */}
              {stores && (
                <select 
                  className="px-4 py-2 bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-xl text-gray-900 dark:text-white"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  data-testid="select-store"
                >
                  {stores.map((store: any) => (
                    <option key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang}
                    </option>
                  ))}
                </select>
              )}

              {/* Import and Create Buttons */}
              <div className="flex space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowImportModal(true)}
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  data-testid="button-import-stock-opname"
                >
                  <i className="fas fa-upload mr-2"></i>
                  Import SO
                </Button>
                
                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      data-testid="button-new-stock-opname"
                    >
                      <i className="fas fa-plus mr-2"></i>
                      New Stock Opname
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Stock Opname</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="so-date">Date</Label>
                        <Input
                          id="so-date"
                          type="date"
                          value={newSoDate}
                          onChange={(e) => setNewSoDate(e.target.value)}
                          data-testid="input-so-date"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowCreateModal(false)}
                          data-testid="button-cancel-so"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateSo}
                          disabled={createSoMutation.isPending}
                          data-testid="button-create-so"
                        >
                          {createSoMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </header>

        {/* Stock Opname Content */}
        <main className="p-6 space-y-6">
          {/* Stock Opname List */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Stock Opname Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {soLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                      <div className="space-y-2">
                        <Skeleton className="w-32 h-4" />
                        <Skeleton className="w-24 h-3" />
                      </div>
                      <Skeleton className="w-20 h-8" />
                    </div>
                  ))
                ) : stockOpnameList && stockOpnameList.length > 0 ? (
                  stockOpnameList
                    .filter((so: any) => !selectedStore || so.kodeGudang === selectedStore)
                    .map((so: any) => (
                      <div 
                        key={so.soId} 
                        className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        data-testid={`card-stock-opname-${so.soId}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            SO #{so.soId} - {so.kodeGudang}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Date: {so.tanggal}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            Active
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSoId(so.soId);
                              setShowAddItemModal(true);
                            }}
                            data-testid={`button-add-item-${so.soId}`}
                          >
                            <i className="fas fa-plus mr-1"></i>
                            Add Items
                          </Button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-clipboard-check text-4xl text-gray-400 mb-4"></i>
                    <p className="text-gray-500 dark:text-gray-400">No stock opname records found</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create a new stock opname to start inventory counting</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variance Analysis */}
          {openingStock && openingStock.length > 0 && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Opening Stock Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Item Code</th>
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Item Name</th>
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Serial Number</th>
                        <th className="text-right py-2 font-medium text-gray-900 dark:text-white">System Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openingStock.slice(0, 10).map((item: any) => (
                        <tr key={item.itemId} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 text-gray-900 dark:text-white">{item.kodeItem}</td>
                          <td className="py-2 text-gray-900 dark:text-white">{item.namaItem}</td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">{item.sn || '-'}</td>
                          <td className="py-2 text-right text-gray-900 dark:text-white">{item.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {openingStock.length > 10 && (
                    <p className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
                      And {openingStock.length - 10} more items...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Add Item Modal */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Stock Opname</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item-sn">Serial Number (Optional)</Label>
              <Input
                id="item-sn"
                value={itemSn}
                onChange={(e) => setItemSn(e.target.value)}
                placeholder="Enter serial number"
                data-testid="input-item-sn"
              />
            </div>
            <div>
              <Label htmlFor="item-code">Item Code *</Label>
              <Input
                id="item-code"
                value={itemKodeItem}
                onChange={(e) => setItemKodeItem(e.target.value)}
                placeholder="Enter item code"
                data-testid="input-item-code"
              />
            </div>
            <div>
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                value={itemNamaItem}
                onChange={(e) => setItemNamaItem(e.target.value)}
                placeholder="Enter item name"
                data-testid="input-item-name"
              />
            </div>
            <div>
              <Label htmlFor="item-qty">Physical Count Quantity *</Label>
              <Input
                id="item-qty"
                type="number"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                placeholder="Enter counted quantity"
                data-testid="input-item-qty"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddItemModal(false);
                  setItemSn('');
                  setItemKodeItem('');
                  setItemNamaItem('');
                  setItemQty('');
                  setSelectedSoId(null);
                }}
                data-testid="button-cancel-add-item"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddItem}
                disabled={addItemMutation.isPending}
                data-testid="button-add-item"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Stock Opname Data"
        tableName="stock-opname"
        queryKey="/api/stock-opname"
        endpoint="/api/import"
        sampleData={[
          'kodeGudang',
          'tanggal (YYYY-MM-DD)'
        ]}
      />
    </div>
  );
}