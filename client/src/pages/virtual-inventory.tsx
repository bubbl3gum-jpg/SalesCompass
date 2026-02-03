import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Upload, Plus, Trash2, Package, Warehouse, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VirtualStoreInventory } from "@shared/schema";

interface Store {
  kodeGudang: string;
  namaGudang: string;
}

export default function VirtualInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [newItem, setNewItem] = useState({
    sn: "",
    kodeItem: "",
    sc: "",
    namaBarang: "",
    qty: 1
  });

  const { data: stores } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
  });

  const inventoryUrl = selectedStore ? `/api/virtual-inventory?store=${selectedStore}` : '/api/virtual-inventory';
  
  const { data: inventory, isLoading: inventoryLoading } = useQuery<VirtualStoreInventory[]>({
    queryKey: [inventoryUrl],
  });

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/virtual-inventory');
      }
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/virtual-inventory', data);
    },
    onSuccess: () => {
      invalidateInventory();
      setShowAddModal(false);
      setNewItem({ sn: "", kodeItem: "", sc: "", namaBarang: "", qty: 1 });
      toast({ title: "Success", description: "Inventory item added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (inventoryId: number) => {
      return await apiRequest('DELETE', `/api/virtual-inventory/${inventoryId}`);
    },
    onSuccess: () => {
      invalidateInventory();
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
    },
  });

  const handleAddItem = () => {
    if (!selectedStore) {
      toast({ title: "Error", description: "Please select a store first", variant: "destructive" });
      return;
    }
    if (!newItem.sn) {
      toast({ title: "Error", description: "Serial number (SN) is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      kodeGudang: selectedStore,
      ...newItem
    });
  };

  const handleFileUpload = async () => {
    if (!selectedStore) {
      toast({ title: "Error", description: "Please select a store first", variant: "destructive" });
      return;
    }
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('kodeGudang', selectedStore);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/virtual-inventory/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      invalidateInventory();
      setShowImportModal(false);
      setImportFile(null);
      
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.success} items. Header found at row ${result.headerRowIndex + 1}.`,
      });

      if (result.errors && result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredInventory = inventory?.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.sn?.toLowerCase().includes(query) ||
      item.kodeItem?.toLowerCase().includes(query) ||
      item.namaBarang?.toLowerCase().includes(query) ||
      item.sc?.toLowerCase().includes(query)
    );
  }) || [];

  const totalItems = filteredInventory.length;
  const totalQty = filteredInventory.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Warehouse className="w-8 h-8 text-purple-600" />
                Virtual Store Inventory
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track inventory across stores with automatic updates from transfers and sales
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowImportModal(true)}
                variant="outline"
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import File
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                  </div>
                  <Package className="w-10 h-10 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Quantity</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalQty}</p>
                  </div>
                  <FileSpreadsheet className="w-10 h-10 text-emerald-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Store</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedStore ? stores?.find(s => s.kodeGudang === selectedStore)?.namaGudang || selectedStore : 'All Stores'}
                    </p>
                  </div>
                  <Warehouse className="w-10 h-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-gray-900 dark:text-white">Inventory Items</CardTitle>
                <div className="flex items-center gap-4">
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Stores</SelectItem>
                      {stores?.map((store) => (
                        <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                          {store.namaGudang || store.kodeGudang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by SN, item code, or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-[300px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {inventoryLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredInventory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead>SN</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Serial Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item) => (
                        <TableRow key={item.inventoryId}>
                          <TableCell>
                            <Badge variant="outline">
                              {stores?.find(s => s.kodeGudang === item.kodeGudang)?.namaGudang || item.kodeGudang}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{item.sn}</TableCell>
                          <TableCell>{item.kodeItem || '-'}</TableCell>
                          <TableCell>{item.sc || '-'}</TableCell>
                          <TableCell>{item.namaBarang || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {item.qty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(item.inventoryId)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No items match your search' : 'No inventory items found'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Add items manually or import from a CSV/Excel file
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new item to the virtual store inventory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Store *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang || store.kodeGudang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serial Number (SN) *</Label>
              <Input
                value={newItem.sn}
                onChange={(e) => setNewItem({ ...newItem, sn: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
            <div>
              <Label>Item Code</Label>
              <Input
                value={newItem.kodeItem}
                onChange={(e) => setNewItem({ ...newItem, kodeItem: e.target.value })}
                placeholder="Enter item code"
              />
            </div>
            <div>
              <Label>Serial Code (SC)</Label>
              <Input
                value={newItem.sc}
                onChange={(e) => setNewItem({ ...newItem, sc: e.target.value })}
                placeholder="Enter serial code"
              />
            </div>
            <div>
              <Label>Item Name</Label>
              <Input
                value={newItem.namaBarang}
                onChange={(e) => setNewItem({ ...newItem, namaBarang: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={newItem.qty}
                onChange={(e) => setNewItem({ ...newItem, qty: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import inventory items. The system will automatically detect headers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Store *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang || store.kodeGudang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              
              {importFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-emerald-500" />
                  <p className="font-medium text-gray-900 dark:text-white">{importFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Drag and drop or click to select
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Supported Columns</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li><strong>SN</strong> (required): s/n, sn, serial, serial number, no seri</li>
                <li><strong>Item Code</strong>: kode item, item code, sku, kode barang</li>
                <li><strong>Serial Code</strong>: sc, serial code, kode serial</li>
                <li><strong>Item Name</strong>: nama barang, nama item, product name, deskripsi</li>
                <li><strong>Qty</strong>: qty, quantity, jumlah, stok</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleFileUpload} 
                disabled={!importFile || !selectedStore || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
