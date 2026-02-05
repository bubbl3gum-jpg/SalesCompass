import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SettlementModal } from "@/components/settlement-modal";
import { format } from "date-fns";
import { Search, Store, Calendar, DollarSign, CreditCard } from "lucide-react";

interface Settlement {
  settlementId: number;
  kodeGudang: string;
  tanggal: string;
  cashAwal: string;
  cashAkhir: string;
  variance: string;
  bazarId: number | null;
}

interface Bazar {
  bazarId: number;
  bazarName: string;
  location: string;
  status: string;
}

interface EdcSettlement {
  edcSettlementId: number;
  settlementId: number;
  settlementValue: string;
}

export default function Settlements() {
  const { isExpanded } = useSidebar();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bazarFilter, setBazarFilter] = useState<string>("all");

  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ['/api/settlements'],
    retry: false,
  });

  const { data: bazars = [] } = useQuery<Bazar[]>({
    queryKey: ['/api/bazars'],
    retry: false,
  });

  const settlementIds = useMemo(() => 
    settlements.map(s => s.settlementId).join(','), 
    [settlements]
  );

  const { data: edcSettlements = [] } = useQuery<EdcSettlement[]>({
    queryKey: ['/api/edc-settlements', { settlement_ids: settlementIds }],
    queryFn: async () => {
      if (!settlementIds) return [];
      const response = await fetch(`/api/edc-settlements?settlement_ids=${settlementIds}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: settlements.length > 0,
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

  const bazarMap = new Map(bazars.map(b => [b.bazarId, b]));

  const filteredSettlements = settlements.filter((settlement) => {
    const matchesSearch = 
      settlement.kodeGudang?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      settlement.tanggal?.includes(searchQuery);
    
    const matchesBazar = 
      bazarFilter === "all" ||
      (bazarFilter === "bazar" && settlement.bazarId) ||
      (bazarFilter === "regular" && !settlement.bazarId) ||
      (bazarFilter && bazarFilter !== "all" && bazarFilter !== "bazar" && bazarFilter !== "regular" && 
        settlement.bazarId?.toString() === bazarFilter);
    
    return matchesSearch && matchesBazar;
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Settlements</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage daily settlements and reconciliation</p>
            </div>
            <Button 
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              onClick={handleOpenModal}
              data-testid="button-new-settlement"
            >
              <i className="fas fa-plus mr-2"></i>
              New Settlement
            </Button>
          </div>
        </header>

        <main className="p-6">
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Daily Settlements ({filteredSettlements.length})
                </CardTitle>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by store or date..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  <Select value={bazarFilter} onValueChange={setBazarFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Settlements</SelectItem>
                      <SelectItem value="regular">Regular Only</SelectItem>
                      <SelectItem value="bazar">Bazar Only</SelectItem>
                      {bazars.map((bazar) => (
                        <SelectItem key={bazar.bazarId} value={bazar.bazarId.toString()}>
                          {bazar.bazarName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-500">Loading settlements...</p>
                </div>
              ) : filteredSettlements.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-calculator text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {searchQuery || bazarFilter !== "all" ? "No matching settlements" : "No settlements yet"}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchQuery || bazarFilter !== "all" 
                      ? "Try adjusting your search or filter criteria"
                      : "Create and manage daily settlements for each store."
                    }
                  </p>
                  {!searchQuery && bazarFilter === "all" && (
                    <Button 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                      onClick={handleOpenModal}
                      data-testid="button-create-first-settlement"
                    >
                      Create First Settlement
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Store/Bazar</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Starting Cash</TableHead>
                        <TableHead className="text-right">Ending Cash</TableHead>
                        <TableHead className="text-right">EDC Total</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSettlements.map((settlement) => {
                        const bazar = settlement.bazarId ? bazarMap.get(settlement.bazarId) : null;
                        const variance = parseFloat(settlement.variance || "0");
                        const edcTotal = edcTotalsBySettlement.get(settlement.settlementId) || 0;
                        return (
                          <TableRow key={settlement.settlementId}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {formatDate(settlement.tanggal)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-gray-400" />
                                {bazar ? bazar.bazarName : settlement.kodeGudang}
                              </div>
                            </TableCell>
                            <TableCell>
                              {bazar ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5" />
                                  Bazar
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                  Regular
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(settlement.cashAwal)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(settlement.cashAkhir)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {edcTotal > 0 ? (
                                <div className="flex items-center justify-end gap-1">
                                  <CreditCard className="h-3 w-3 text-blue-500" />
                                  <span className="text-blue-600">{formatCurrency(edcTotal)}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono font-medium",
                              variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : ""
                            )}>
                              {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
      
      <SettlementModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}
