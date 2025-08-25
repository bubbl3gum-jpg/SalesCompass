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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

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
    failedRecords?: Array<{ record: any; error: string; originalIndex: number }>;
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    setEditingRecord(null);
    setEditingIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const retryMutation = useMutation({
    mutationFn: async (record: any) => {
      const response = await apiRequest('POST', '/api/import/retry', {
        tableName,
        record
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Remove the successfully retried record from failed records
      if (importResults && importResults.failedRecords) {
        const updatedFailedRecords = importResults.failedRecords.filter(
          (_, index) => index !== editingIndex
        );
        setImportResults({
          ...importResults,
          success: importResults.success + 1,
          failed: importResults.failed - 1,
          failedRecords: updatedFailedRecords
        });
      }
      
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setEditingRecord(null);
      setEditingIndex(null);
      
      toast({
        title: "Success",
        description: "Record imported successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Retry Failed",
        description: (error as Error).message || "Failed to import record",
        variant: "destructive",
      });
    },
  });

  const handleEditRecord = (record: any, index: number) => {
    setEditingRecord({ ...record });
    setEditingIndex(index);
  };

  const handleRetryRecord = () => {
    if (editingRecord) {
      retryMutation.mutate(editingRecord);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (editingRecord) {
      setEditingRecord({ ...editingRecord, [field]: value });
    }
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
                    <div className="text-sm text-green-700">Successfully Imported</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-sm text-red-700">Failed</div>
                  </CardContent>
                </Card>
              </div>

              {importResults.errors.length > 0 && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Import Errors:</h4>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {importResults.errors.map((error, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-red-500 mt-1">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {importResults.failedRecords && importResults.failedRecords.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-amber-900 mb-4">Failed Records - Click to Edit & Retry</h4>
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead className="w-24">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResults.failedRecords.map((failedRecord, index) => (
                            <TableRow key={index} className="hover:bg-amber-100 cursor-pointer">
                              <TableCell className="font-mono text-xs">{failedRecord.originalIndex + 1}</TableCell>
                              <TableCell className="max-w-xs">
                                <div className="text-xs space-y-1">
                                  {Object.entries(failedRecord.record).map(([key, value]) => (
                                    <div key={key} className="flex">
                                      <span className="font-medium text-slate-600 mr-2">{key}:</span>
                                      <span className="text-slate-800 truncate">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-red-600 max-w-xs">
                                {failedRecord.error}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditRecord(failedRecord.record, index)}
                                  data-testid={`button-edit-failed-record-${index}`}
                                  className="w-full"
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Edit Failed Record Modal */}
          {editingRecord && (
            <Card className="mt-4 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-900 mb-4">Edit Failed Record</h4>
                <div className="space-y-3">
                  {Object.entries(editingRecord).map(([key, value]) => (
                    <div key={key}>
                      <Label htmlFor={`edit-${key}`} className="text-sm font-medium text-blue-800">
                        {key}
                      </Label>
                      <Input
                        id={`edit-${key}`}
                        value={String(value || '')}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="mt-1"
                        data-testid={`input-edit-${key}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRecord(null);
                      setEditingIndex(null);
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRetryRecord}
                    disabled={retryMutation.isPending}
                    data-testid="button-retry-record"
                  >
                    {retryMutation.isPending ? 'Retrying...' : 'Retry Import'}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
            {selectedFile && !importResults && (
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                data-testid="button-start-import"
              >
                {importMutation.isPending ? 'Importing...' : 'Import Data'}
              </Button>
            )}
            {importResults && importResults.failed === 0 && (
              <Button onClick={handleClose} data-testid="button-finish-import">
                Finish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}