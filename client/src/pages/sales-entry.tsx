import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { useSidebar } from "@/hooks/useSidebar";
import { SalesEntryModal } from "@/components/sales-entry-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function SalesEntry() {
  const { isExpanded } = useSidebar();
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  // Get stores
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get sales data
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["/api/sales", selectedStore, dateFilter],
    enabled: !!selectedStore,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Entry</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Record and manage sales transactions</p>
            </div>
            <Button
              onClick={() => setShowSalesModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              data-testid="button-new-sale"
              disabled={!selectedStore}
            >
              <i className="fas fa-plus mr-2"></i>
              New Sale
            </Button>
          </div>
          
          {/* Store Selector - Moved to header */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Select Store:
            </label>
            <div className="flex-1 max-w-sm">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger data-testid="select-store-main">
                  <SelectValue placeholder="Choose your store..." />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store: any) => (
                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedStore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStore('')}
                className="text-xs"
                data-testid="button-clear-store"
              >
                Clear
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Date Filter - Simplified */}
          {selectedStore && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Filter by Date:
                  </label>
                  <div className="flex-1 max-w-xs">
                    <Input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      data-testid="input-date-filter"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-reset-date"
                    onClick={() => {
                      setDateFilter(new Date().toISOString().split('T')[0]);
                    }}
                  >
                    Today
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales List */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Sales Transactions
                {sales && <span className="ml-2 text-sm text-gray-500">({sales.length} records)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                          <div className="space-y-2">
                            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                          <div className="w-16 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sales && sales.length > 0 ? (
                <div className="space-y-4">
                  {sales.map((sale: any) => (
                    <div
                      key={sale.penjualanId}
                      className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                      data-testid={`card-sale-${sale.penjualanId}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-receipt text-white"></i>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {sale.kodeItem}
                            {sale.serialNumber && <span className="ml-2 text-sm text-gray-500">({sale.serialNumber})</span>}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {sale.tanggal} • Store: {sale.kodeGudang}
                          </p>
                          {sale.notes && (
                            <p className="text-xs text-gray-400 mt-1">{sale.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          Rp {parseFloat(sale.finalPrice || '0').toLocaleString()}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {sale.preOrder && (
                            <Badge variant="secondary" className="text-xs">
                              Pre-Order
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {sale.paymentMethod || 'Cash'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedStore ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-receipt text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No sales found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    No sales transactions found for the selected filters.
                  </p>
                  <Button
                    onClick={() => setShowSalesModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    data-testid="button-create-first-sale"
                  >
                    Record First Sale
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-store text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a store</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Please select a store to view sales transactions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <SalesEntryModal
        isOpen={showSalesModal}
        onClose={() => setShowSalesModal(false)}
        selectedStore={selectedStore}
      />
    </div>
  );
}
