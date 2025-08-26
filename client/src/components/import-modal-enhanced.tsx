import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImportProgress } from '@/components/ImportProgress';
import { apiRequest } from '@/lib/queryClient';

interface ImportModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStart: (importId: string) => void;
  tableConfig?: {
    name: string;
    displayName: string;
    importTable: string;
  };
}

export function ImportModalEnhanced({ 
  isOpen, 
  onClose, 
  onImportStart, 
  tableConfig 
}: ImportModalEnhancedProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>(tableConfig?.importTable || '');
  const [isUploading, setIsUploading] = useState(false);
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (allowedTypes.includes(file.type) || file.name.match(/\.(csv|xlsx?|xlsm)$/i)) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV or Excel file (.csv, .xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedTable) {
      toast({
        title: "Missing Information",
        description: "Please select both a file and table type",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tableName', selectedTable);

      const response = await apiRequest('POST', '/api/import', formData);
      const result = await response.json();

      if (result.success) {
        setCurrentImportId(result.importId);
        onImportStart(result.importId);
        toast({
          title: "Import Started",
          description: `Import has begun for ${selectedTable}. You can track progress below.`,
        });
        
        // Reset form
        setSelectedFile(null);
        setSelectedTable(tableConfig?.importTable || '');
      } else {
        throw new Error(result.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading && !currentImportId) {
      setSelectedFile(null);
      setSelectedTable(tableConfig?.importTable || '');
      setCurrentImportId(null);
      onClose();
    }
  };

  const handleImportComplete = () => {
    setCurrentImportId(null);
    setTimeout(() => {
      onClose();
    }, 2000); // Close modal 2 seconds after completion
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="import-modal-enhanced">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import {tableConfig?.displayName || 'Data'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!currentImportId ? (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-input">Select File</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls,.xlsm"
                    onChange={handleFileSelect}
                    className="mt-1"
                    data-testid="file-input"
                  />
                  {selectedFile && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{selectedFile.name}</span>
                      <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>

                {!tableConfig && (
                  <div>
                    <Label htmlFor="table-select">Table Type</Label>
                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                      <SelectTrigger className="mt-1" data-testid="table-select">
                        <SelectValue placeholder="Select table type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reference-sheet">Reference Sheet</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="stores">Stores</SelectItem>
                        <SelectItem value="discounts">Discounts</SelectItem>
                        <SelectItem value="edc">EDC/Payment Methods</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">Import Guidelines:</p>
                      <ul className="mt-1 text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• CSV files should have headers in the first row</li>
                        <li>• Excel files (.xlsx, .xls) are supported</li>
                        <li>• Large files will show progress during import</li>
                        <li>• Invalid records will be reported after import</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={isUploading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || !selectedTable || isUploading}
                  data-testid="button-import"
                >
                  {isUploading ? "Starting Import..." : "Start Import"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <ImportProgress
                importId={currentImportId}
                onComplete={handleImportComplete}
              />
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Import in progress. This dialog will close automatically when complete.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}