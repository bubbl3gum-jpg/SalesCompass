import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tableName: string;
  queryKey: string;
  endpoint: string;
  acceptedFormats?: string;
  sampleData?: string[];
  additionalData?: Record<string, any>;
}

export function ImportModal({
  isOpen,
  onClose,
  title,
  tableName,
  queryKey,
  endpoint,
  acceptedFormats = ".csv,.xlsx,.xls",
  sampleData = [],
  additionalData
}: ImportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableName', tableName);
      
      // Add additional data if provided
      if (additionalData) {
        formData.append('additionalData', JSON.stringify(additionalData));
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(data);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      
      if (data.success > 0) {
        toast({
          title: "Import Completed",
          description: `Successfully imported ${data.success} records${data.failed > 0 ? `, ${data.failed} failed` : ''}`,
          variant: data.failed > 0 ? "destructive" : "default",
        });
      }
      
      if (data.failed === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
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
        title: "Import Failed",
        description: (error as Error).message || "Failed to import data",
        variant: "destructive",
      });
      setImportResults({
        success: 0,
        failed: 0,
        errors: [(error as Error).message || "Import failed"]
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx?|xlsm)$/i)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV or Excel file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setImportResults(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(0);
    importMutation.mutate(selectedFile);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResults(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) return 'fas fa-file-csv';
    if (fileName.match(/\.xlsx?$/)) return 'fas fa-file-excel';
    return 'fas fa-file';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <i className="fas fa-upload mr-2 text-blue-600 dark:text-blue-400"></i>
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Selection */}
          <div className="space-y-3">
            <Label htmlFor="import-file" className="text-gray-900 dark:text-gray-100 font-medium">Select File</Label>
            <div className="flex items-center space-x-3">
              <Input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept={acceptedFormats}
                onChange={handleFileSelect}
                disabled={importMutation.isPending}
                className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-import-file"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={importMutation.isPending}
                data-testid="button-browse-file"
              >
                <i className="fas fa-folder-open mr-2"></i>
                Browse
              </Button>
            </div>
            
            {selectedFile && (
              <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <i className={`${getFileIcon(selectedFile.name)} text-blue-600 text-lg`}></i>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Ready
                </Badge>
              </div>
            )}
          </div>

          {/* Sample Data Format */}
          {sampleData.length > 0 && (
            <div className="space-y-2">
              <Label>Expected Column Format</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {sampleData.join(', ')}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Make sure your file has these columns in any order. Extra columns will be ignored.
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Processing...</Label>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                  <p className="text-sm text-green-600">Successfully Imported</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                  <p className="text-sm text-red-600">Failed</p>
                </div>
              </div>
              
              {importResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Import Errors:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {importResults.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResults.errors.length > 5 && (
                          <li>... and {importResults.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={importMutation.isPending}
              data-testid="button-cancel-import"
            >
              {importResults ? 'Close' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              data-testid="button-start-import"
            >
              {importMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Importing...
                </>
              ) : (
                <>
                  <i className="fas fa-upload mr-2"></i>
                  Import Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}