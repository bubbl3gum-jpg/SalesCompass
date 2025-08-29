import { memo, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Edit3, Trash2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { debounce } from "lodash";

const FIELDS = [
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
];

const ReferenceSheetTab = memo(() => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
    []
  );

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/reference-sheets'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((item: any) =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  // Paginated data for virtual scrolling
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
  const paginatedData = useMemo(() => {
    const start = 0;
    const end = page * itemsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiRequest('POST', '/api/reference-sheets', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setShowModal(false);
      setFormData({});
      toast({ title: "Success", description: "Item created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      const response = await apiRequest('PUT', `/api/reference-sheets/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      toast({ title: "Success", description: "Item updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/reference-sheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setDeleteItem(null);
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.refId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [editingItem, formData, createMutation, updateMutation]);

  const handleEdit = useCallback((item: any) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (paginatedData.length < filteredData.length) {
      setPage(p => p + 1);
    }
  }, [paginatedData.length, filteredData.length]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Reference Sheet (Items Master)</CardTitle>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <Badge variant="secondary">{selectedItems.size} selected</Badge>
            )}
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormData({});
                setShowModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-md border">
          <div className="max-h-[500px] overflow-y-auto" onScroll={(e) => {
            const target = e.target as HTMLElement;
            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
              handleLoadMore();
            }
          }}>
            <table className="w-full">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="p-2 text-left">
                    <Checkbox
                      checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItems(new Set(filteredData.map((item: any) => item.refId)));
                        } else {
                          setSelectedItems(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="p-2 text-left">Item Code</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left">Group</th>
                  <th className="p-2 text-left">Family</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">Loading...</td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">No items found</td>
                  </tr>
                ) : (
                  paginatedData.map((item: any) => (
                    <tr key={item.refId} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Checkbox
                          checked={selectedItems.has(item.refId)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedItems);
                            if (checked) {
                              newSet.add(item.refId);
                            } else {
                              newSet.delete(item.refId);
                            }
                            setSelectedItems(newSet);
                          }}
                        />
                      </td>
                      <td className="p-2">{item.kodeItem}</td>
                      <td className="p-2">{item.namaItem}</td>
                      <td className="p-2">{item.kelompok}</td>
                      <td className="p-2">{item.family}</td>
                      <td className="p-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {paginatedData.length < filteredData.length && (
              <div className="p-4 text-center">
                <Button variant="outline" onClick={handleLoadMore}>
                  Load More ({filteredData.length - paginatedData.length} remaining)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Item' : 'Create New Item'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type}
                      required={field.required}
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteItem?.namaItem}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteItem.refId)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
});

ReferenceSheetTab.displayName = 'ReferenceSheetTab';

export default ReferenceSheetTab;