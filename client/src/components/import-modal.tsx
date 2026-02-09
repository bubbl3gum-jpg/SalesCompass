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
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string>('');
  const [throughputRps, setThroughputRps] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors?: string[];
    failedRecords?: Array<{ record: any; error: string; originalIndex: number }>;
    summary?: {
      totalRecords: number;
      newRecords: number;
      updatedRecords: number;
      duplicatesRemoved: number;
      errorRecords: number;
    };
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableName', tableName);
      
      // Add additional data if provided
      if (additionalData) {
        formData.append('additionalData', JSON.stringify(additionalData));
      }

      // Start the import
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      // The new API returns a job ID immediately for background processing
      if (result.jobId) {
        setJobId(result.jobId);
        
        // Start real-time progress tracking via Server-Sent Events
        const sseUrl = `/api/import/progress/${result.jobId}/stream`;
        const sse = new EventSource(sseUrl);
        setEventSource(sse);
        
        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Update progress percentage
            if (data.progress && data.progress.total > 0) {
              const percentage = Math.round((data.progress.current / data.progress.total) * 100);
              setUploadProgress(percentage);
              setProgressStage(data.progress.stage || data.message);
              
              // Show throughput and ETA if available
              if (data.progress.throughputRps) {
                setThroughputRps(data.progress.throughputRps);
              }
              if (data.progress.eta) {
                setEta(data.progress.eta);
              }
            }
            
            // Handle completion
            if (data.status === 'completed' && data.result) {
              setImportResults(data.result);
              sse.close();
              setEventSource(null);
            }
            
            // Handle failure
            if (data.status === 'failed') {
              setImportResults({
                success: 0,
                failed: 0,
                errors: [data.error || 'Import failed']
              });
              sse.close();
              setEventSource(null);
            }
          } catch (error) {
            console.error('SSE parsing error:', error);
          }
        };
        
        sse.onerror = (error) => {
          console.error('SSE connection error:', error);
          sse.close();
          setEventSource(null);
        };
      }

      return result;
    },
    onSuccess: (data) => {
      // Job submitted successfully - real-time updates will come via SSE
      if (data.jobId) {
        toast({
          title: "Import Started",
          description: `Job submitted successfully. Processing in background with ID: ${data.jobId.substring(0, 8)}...`,
          variant: "default",
        });
      }
    },
    onError: (error) => {
      // Close SSE connection if it exists
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      
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
        title: "Import Failed",
        description: (error as Error).message || "Failed to start import job",
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
    // Close SSE connection if active
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    
    setSelectedFile(null);
    setImportResults(null);
    setUploadProgress(0);
    setJobId(null);
    setProgressStage('');
    setThroughputRps(null);
    setEta(null);
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

          {/* Enhanced Real-time Progress */}
          {(importMutation.isPending || jobId) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Processing...</span>
                </Label>
                <span className="text-sm text-gray-500 font-mono">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-3" />
              
              {/* Progress Stage */}
              {progressStage && (
                <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                  <span>{progressStage}</span>
                  {jobId && (
                    <span className="font-mono text-blue-600">Job: {jobId.substring(0, 8)}...</span>
                  )}
                </div>
              )}
              
              {/* Performance Metrics */}
              <div className="flex justify-between text-xs text-gray-500">
                {throughputRps && (
                  <span>⚡ {Math.round(throughputRps).toLocaleString()} rows/sec</span>
                )}
                {eta && (
                  <span>⏱️ ETA: {Math.round(eta)}s</span>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Import Results */}
          {importResults && (
            <div className="space-y-4">
              {/* Success Banner */}
              {importResults.success > 0 && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Import completed successfully! {importResults.success.toLocaleString()} records processed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Enhanced Summary for Bulk Operations */}
              {importResults.summary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">{importResults.summary.totalRecords.toLocaleString()}</div>
                      <div className="text-xs text-blue-700">Total Processed</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200 hover:bg-green-100 transition-colors">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-green-600">{importResults.summary.newRecords.toLocaleString()}</div>
                      <div className="text-xs text-green-700">New Records</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50 border-amber-200 hover:bg-amber-100 transition-colors">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-amber-600">{importResults.summary.updatedRecords.toLocaleString()}</div>
                      <div className="text-xs text-amber-700">Updated Records</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 border-purple-200 hover:bg-purple-100 transition-colors">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-purple-600">{importResults.summary.duplicatesRemoved.toLocaleString()}</div>
                      <div className="text-xs text-purple-700">Duplicates Removed</div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-green-50 border-green-200 hover:bg-green-100 transition-colors">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{importResults.success.toLocaleString()}</div>
                      <div className="text-sm text-green-700">Successfully Imported</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200 hover:bg-red-100 transition-colors">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{importResults.failed.toLocaleString()}</div>
                      <div className="text-sm text-red-700">Failed</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {importResults.errors && importResults.errors.length > 0 && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Import Errors:</h4>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {importResults.errors?.map((error, index) => (
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
              {importResults ? 'Close' : jobId ? 'Close (Running in Background)' : 'Cancel'}
            </Button>
            {selectedFile && !importResults && (
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || !!jobId}
                data-testid="button-start-import"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {importMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting Import...
                  </>
                ) : jobId ? (
                  <>
                    <div className="animate-pulse w-2 h-2 bg-white rounded-full mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Import Data'
                )}
              </Button>
            )}
            {importResults && importResults.failed === 0 && (
              <Button 
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: [queryKey] });
                  toast({
                    title: "Data Refreshed",
                    description: "The table has been updated with the imported data.",
                  });
                  handleClose();
                }} 
                data-testid="button-finish-import"
                className="bg-green-600 hover:bg-green-700"
              >
                Finish & Refresh Data
              </Button>
            )}
            
            {/* Cancel Job Button */}
            {jobId && !importResults && (
              <Button 
                variant="destructive"
                onClick={async () => {
                  try {
                    await fetch(`/api/import/${jobId}`, { method: 'DELETE' });
                    toast({
                      title: "Import Cancelled",
                      description: "The import job has been cancelled.",
                    });
                    handleClose();
                  } catch (error) {
                    toast({
                      title: "Cancel Failed",
                      description: "Failed to cancel the import job.",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-cancel-job"
              >
                Cancel Import
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}