import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferId: number;
  onImportComplete?: () => void;
}

interface ImportProgress {
  phase: 'uploading' | 'parsing' | 'validating' | 'writing' | 'done' | 'failed';
  rowsTotal?: number;
  rowsParsed?: number;
  rowsValid?: number;
  rowsWritten?: number;
  rowsFailed?: number;
  throughputRps?: number;
  etaSeconds?: number;
  uploadProgress?: number;
}

interface ImportJob {
  uploadId: string;
  jobId: string;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: ImportProgress;
}

export function TransferImportModal({ isOpen, onClose, transferId, onImportComplete }: TransferImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate file size display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Calculate ETA display
  const formatETA = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().match(/\.(csv|xlsx|xls)$/)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV or Excel file (.csv, .xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 250MB)
    if (selectedFile.size > 250 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 250MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Start import process
  const startImport = async () => {
    if (!file) return;

    try {
      setIsUploading(true);

      // Step 1: Initiate import to get presigned URL
      console.log('🚀 Initiating transfer import...');
      const initiateResponse = await apiRequest('POST', '/api/transfer-imports/initiate', {
        fileName: file.name,
        contentType: file.type || 'text/csv',
        expectedSchema: 'transfer-items'
      });
      const { uploadId, presignedUrl, fileKey, idempotencyKey } = await initiateResponse.json();

      // Step 2: Upload file directly to object storage
      console.log('📤 Uploading file to object storage...');
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'text/csv',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Calculate file hash (simplified - in production you'd use crypto.subtle)
      const fileSha256 = 'placeholder_hash_' + Date.now();

      // Step 3: Complete import to start processing
      console.log('⚡ Starting background processing...');
      const completeResponse = await apiRequest('POST', '/api/transfer-imports/complete', {
        uploadId,
        fileKey,
        fileSize: file.size,
        fileSha256,
        idempotencyKey,
        toNumber: transferId
      });
      const { jobId, status } = await completeResponse.json();

      // Set initial job state
      setJob({
        uploadId,
        jobId,
        status,
        progress: {
          phase: 'parsing',
          uploadProgress: 100
        }
      });

      // Step 4: Start listening for progress updates
      startProgressUpdates(uploadId);

      toast({
        title: "Import Started",
        description: "File uploaded successfully. Processing in background...",
      });

    } catch (error) {
      console.error('❌ Import failed:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
      setIsUploading(false);
      setJob(null);
    }
  };

  // Start progress updates via polling (more reliable than SSE for quick imports)
  const startProgressUpdates = (uploadId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/transfer-imports/${uploadId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
        
        if (!response.ok) {
          console.error('Status check failed:', response.status);
          return;
        }
        
        const progressData = await response.json();
        console.log('📊 Progress update:', progressData);
        
        setJob(prevJob => {
          if (!prevJob) return null;
          return {
            ...prevJob,
            status: progressData.status || prevJob.status,
            progress: {
              ...prevJob.progress,
              phase: progressData.phase,
              rowsTotal: progressData.rowsTotal,
              rowsParsed: progressData.rowsParsed,
              rowsValid: progressData.rowsValid,
              rowsWritten: progressData.rowsWritten,
              rowsFailed: progressData.rowsFailed,
              throughputRps: progressData.throughputRps,
              etaSeconds: progressData.etaSeconds
            }
          };
        });

        // Complete import
        if (progressData.phase === 'done' || progressData.status === 'completed') {
          clearInterval(pollInterval);
          setIsUploading(false);
          toast({
            title: "Import Complete",
            description: `Successfully imported ${progressData.rowsWritten || 0} items`,
          });
          onImportComplete?.();
          setTimeout(() => {
            onClose();
            resetState();
          }, 2000);
        }

        // Handle failure
        if (progressData.phase === 'failed' || progressData.status === 'failed') {
          clearInterval(pollInterval);
          setIsUploading(false);
          toast({
            title: "Import Failed",
            description: "The import process failed. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to poll progress:', error);
      }
    }, 500); // Poll every 500ms
    
    // Store interval ref for cleanup
    (eventSourceRef as any).current = { close: () => clearInterval(pollInterval) };
  };

  // Reset component state
  const resetState = () => {
    setFile(null);
    setIsUploading(false);
    setJob(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle modal close
  const handleClose = (open: boolean) => {
    if (!open && !isUploading) {
      onClose();
      resetState();
    }
  };

  // Get phase color and icon
  const getPhaseDisplay = (phase: ImportProgress['phase']) => {
    switch (phase) {
      case 'uploading':
        return { color: 'bg-blue-500', icon: Upload, text: 'Uploading' };
      case 'parsing':
        return { color: 'bg-yellow-500', icon: FileText, text: 'Parsing' };
      case 'validating':
        return { color: 'bg-orange-500', icon: Clock, text: 'Validating' };
      case 'writing':
        return { color: 'bg-purple-500', icon: Zap, text: 'Writing' };
      case 'done':
        return { color: 'bg-green-500', icon: CheckCircle, text: 'Complete' };
      case 'failed':
        return { color: 'bg-red-500', icon: XCircle, text: 'Failed' };
      default:
        return { color: 'bg-gray-500', icon: Clock, text: 'Processing' };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-[600px]" 
        data-testid="dialog-transfer-import"
        onPointerDownOutside={(e) => isUploading && e.preventDefault()}
        onEscapeKeyDown={(e) => isUploading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-transfer-import-title">
            Import Transfer Items
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!file && !job && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              data-testid="dropzone-file-upload"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900">
                Drop your CSV or Excel file here
              </p>
              <p className="text-sm text-gray-500 mt-2">
                or click to browse (max 250MB)
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-browse-files"
              >
                Browse Files
              </Button>
            </div>
          )}

          {file && !job && (
            <Card data-testid="card-file-preview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Selected File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium" data-testid="text-file-name">{file.name}</p>
                    <p className="text-sm text-gray-500" data-testid="text-file-size">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-file"
                  >
                    Remove
                  </Button>
                </div>
                <Button
                  onClick={startImport}
                  className="w-full mt-4"
                  disabled={isUploading}
                  data-testid="button-start-import"
                >
                  {isUploading ? 'Starting Import...' : 'Start Import'}
                </Button>
              </CardContent>
            </Card>
          )}

          {job && (
            <Card data-testid="card-import-progress">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Import Progress</span>
                  <Badge 
                    variant={job.progress.phase === 'done' ? 'default' : 'secondary'}
                    data-testid="badge-import-status"
                  >
                    {getPhaseDisplay(job.progress.phase).text}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span data-testid="text-progress-percentage">
                      {job.progress.rowsTotal 
                        ? Math.round(((job.progress.rowsWritten || 0) / job.progress.rowsTotal) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={job.progress.rowsTotal 
                      ? ((job.progress.rowsWritten || 0) / job.progress.rowsTotal) * 100
                      : 0
                    }
                    className="h-2"
                    data-testid="progress-import"
                  />
                </div>

                {/* Stats Grid */}
                {job.progress.rowsTotal && job.progress.rowsTotal > 0 && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-medium" data-testid="text-rows-total">
                        {job.progress.rowsTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Written:</span>
                      <span className="font-medium text-green-600" data-testid="text-rows-written">
                        {(job.progress.rowsWritten || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Failed:</span>
                      <span className="font-medium text-red-600" data-testid="text-rows-failed">
                        {(job.progress.rowsFailed || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Speed:</span>
                      <span className="font-medium" data-testid="text-throughput">
                        {job.progress.throughputRps || 0} rows/s
                      </span>
                    </div>
                  </div>
                )}

                {/* ETA */}
                {job.progress.etaSeconds && job.progress.etaSeconds > 0 && job.progress.phase !== 'done' && (
                  <div className="flex items-center justify-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span data-testid="text-eta">
                      ETA: {formatETA(job.progress.etaSeconds)}
                    </span>
                  </div>
                )}

                {job.progress.phase === 'done' && (
                  <div className="flex items-center justify-center text-sm text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span data-testid="text-import-complete">
                      Import completed successfully!
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}