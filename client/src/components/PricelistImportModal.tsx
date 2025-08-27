import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, AlertCircle, CheckCircle2, Clock, X } from "lucide-react";

interface PricelistImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ImportProgress {
  phase: 'parsing' | 'validating' | 'writing' | 'done' | 'failed';
  rowsParsed: number;
  rowsValid: number;
  rowsWritten: number;
  rowsFailed: number;
  throughputRps?: number;
  eta?: number;
}

export function PricelistImportModal({ 
  isOpen, 
  onClose, 
  onComplete 
}: PricelistImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'parsing',
    rowsParsed: 0,
    rowsValid: 0,
    rowsWritten: 0,
    rowsFailed: 0
  });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // File validation
  const validateFile = (file: File): string | null => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    
    const isValidType = validTypes.includes(file.type) || 
                       validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
      return 'Please select a CSV or Excel file (.csv, .xls, .xlsx)';
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return 'File size must be less than 50MB';
    }
    
    return null;
  };

  // File selection handlers
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid File",
        description: error,
        variant: "destructive"
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  // Initiate import mutation
  const initiateMutation = useMutation({
    mutationFn: async (file: File) => {
      const response = await apiRequest('POST', '/api/pricelist-imports/initiate', {
        fileName: file.name,
        contentType: file.type,
        expectedSchema: 'pricelist'
      });
      return response.json();
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
        description: "Failed to initiate pricelist import",
        variant: "destructive"
      });
    }
  });

  // Complete import mutation
  const completeMutation = useMutation({
    mutationFn: async (params: {
      uploadId: string;
      fileKey: string;
      fileSize: number;
      fileSha256: string;
      idempotencyKey: string;
    }) => {
      const response = await apiRequest('POST', '/api/pricelist-imports/complete', params);
      return response.json();
    },
    onError: (error) => {
      console.error('Complete import error:', error);
      toast({
        title: "Import Failed",
        description: "Failed to start processing",
        variant: "destructive"
      });
      setImportStatus('failed');
    }
  });

  // Handle import process
  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setImportStatus('uploading');
      setUploadProgress(0);

      // Step 1: Initiate import
      const initResult = await initiateMutation.mutateAsync(selectedFile);
      console.log('📤 Initiate result:', initResult);

      // Step 2: Upload file to presigned URL
      const uploadResponse = await fetch(initResult.presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      setUploadProgress(100);

      // Step 3: Complete import and start processing
      const fileBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileSha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const completeResult = await completeMutation.mutateAsync({
        uploadId: initResult.uploadId,
        fileKey: initResult.fileKey,
        fileSize: selectedFile.size,
        fileSha256,
        idempotencyKey: initResult.idempotencyKey
      });

      console.log('✅ Complete result:', completeResult);
      
      setJobId(completeResult.jobId);
      setImportStatus('processing');

      // Step 4: Subscribe to progress updates
      const eventsUrl = `/api/pricelist-imports/${completeResult.jobId}/events`;
      const eventSourceInstance = new EventSource(eventsUrl);
      setEventSource(eventSourceInstance);

      eventSourceInstance.onmessage = (event) => {
        try {
          const progressData = JSON.parse(event.data) as ImportProgress & { status: string };
          console.log('📊 Progress update:', progressData);
          
          setImportProgress(progressData);
          
          if (progressData.status === 'completed') {
            setImportStatus('completed');
            eventSourceInstance.close();
            setEventSource(null);
            onComplete?.();
            
            toast({
              title: "Import Completed",
              description: `Successfully imported ${progressData.rowsWritten} pricelist items`,
            });
          } else if (progressData.status === 'failed') {
            setImportStatus('failed');
            eventSourceInstance.close();
            setEventSource(null);
            
            toast({
              title: "Import Failed",
              description: "The import process failed. Please try again.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Progress parsing error:', error);
        }
      };

      eventSourceInstance.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSourceInstance.close();
        setEventSource(null);
        setImportStatus('failed');
      };

    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('failed');
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    // Cleanup
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    
    // Reset state
    setSelectedFile(null);
    setImportStatus('idle');
    setUploadProgress(0);
    setImportProgress({
      phase: 'parsing',
      rowsParsed: 0,
      rowsValid: 0,
      rowsWritten: 0,
      rowsFailed: 0
    });
    setJobId(null);
    
    onClose();
  };

  const getProgressPercentage = () => {
    if (importStatus === 'uploading') {
      return uploadProgress;
    }
    
    if (importStatus === 'processing') {
      const total = Math.max(importProgress.rowsParsed, importProgress.rowsValid, 1);
      const processed = importProgress.rowsWritten;
      return Math.min((processed / total) * 100, 95);
    }
    
    if (importStatus === 'completed') {
      return 100;
    }
    
    return 0;
  };

  const getStatusIcon = () => {
    switch (importStatus) {
      case 'uploading':
      case 'processing':
        return <Clock className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (importStatus) {
      case 'uploading':
        return 'Uploading file...';
      case 'processing':
        return importProgress.phase === 'parsing' ? 'Parsing file...' :
               importProgress.phase === 'validating' ? 'Validating data...' :
               importProgress.phase === 'writing' ? 'Writing to database...' :
               'Processing...';
      case 'completed':
        return 'Import completed successfully!';
      case 'failed':
        return 'Import failed. Please try again.';
      default:
        return 'Ready to import';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Import Pricelist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          {!selectedFile && importStatus === 'idle' && (
            <>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Drop your pricelist file here</p>
                <p className="text-gray-500 mb-4">or click to browse</p>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  Select File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <p className="text-xs text-gray-400 mt-4">
                  Supports CSV, XLS, and XLSX files (max 50MB)
                </p>
              </div>

              {/* Sample Data Format */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Expected Columns</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Your file should contain these columns (column names are flexible):
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Badge variant="outline">sn (serial number)</Badge>
                    <Badge variant="outline">kode_item (required)</Badge>
                    <Badge variant="outline">kelompok</Badge>
                    <Badge variant="outline">family</Badge>
                    <Badge variant="outline">kode_material</Badge>
                    <Badge variant="outline">kode_motif</Badge>
                    <Badge variant="outline">nama_motif</Badge>
                    <Badge variant="outline">normal_price (required)</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Column headers are case-insensitive and support variations (e.g., "Kode Item", "kode item", "item_code")
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Selected File Info */}
          {selectedFile && importStatus === 'idle' && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Display */}
          {(importStatus === 'uploading' || importStatus === 'processing') && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon()}
                  <span className="font-medium">{getStatusText()}</span>
                </div>
                
                <Progress value={getProgressPercentage()} className="h-2" />
                
                {importStatus === 'processing' && (
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">
                        {importProgress.rowsParsed.toLocaleString()}
                      </div>
                      <div className="text-gray-500">Parsed</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">
                        {importProgress.rowsValid.toLocaleString()}
                      </div>
                      <div className="text-gray-500">Valid</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">
                        {importProgress.rowsWritten.toLocaleString()}
                      </div>
                      <div className="text-gray-500">Written</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">
                        {importProgress.rowsFailed.toLocaleString()}
                      </div>
                      <div className="text-gray-500">Failed</div>
                    </div>
                  </div>
                )}

                {importProgress.throughputRps && importProgress.eta && (
                  <div className="text-xs text-gray-500 text-center">
                    Processing {importProgress.throughputRps.toFixed(1)} items/sec • 
                    ETA {Math.ceil(importProgress.eta)}s
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completion Message */}
          {importStatus === 'completed' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {importProgress.rowsWritten.toLocaleString()} pricelist items!
                {importProgress.rowsFailed > 0 && ` ${importProgress.rowsFailed} items failed validation.`}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {importStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Import failed. Please check your file format and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            {(importStatus === 'idle' || importStatus === 'completed' || importStatus === 'failed') && (
              <Button variant="outline" onClick={handleClose}>
                {importStatus === 'completed' ? 'Done' : 'Cancel'}
              </Button>
            )}
            
            {importStatus === 'idle' && selectedFile && (
              <Button 
                onClick={handleImport}
                disabled={initiateMutation.isPending || completeMutation.isPending}
              >
                Start Import
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}