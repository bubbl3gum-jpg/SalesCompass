import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Minimize2, Maximize2, X, CheckCircle, XCircle, Loader2, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportJob {
  jobId: string;
  tableName: string;
  status: string;
  stage: string;
  current: number;
  total: number;
  error?: string;
  throughputRps?: number;
  eta?: number;
  isComplete?: boolean;
}

export function BackgroundImportTracker() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());

  // Poll for active import jobs
  const { data: jobs = [] } = useQuery<ImportJob[]>({
    queryKey: ['/api/import/jobs'],
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Filter out dismissed jobs and show only active or recently completed jobs
  const activeJobs = jobs.filter(job => 
    !dismissedJobs.has(job.jobId) && 
    (job.status === 'processing' || job.status === 'uploading' || job.status === 'completed' || job.status === 'failed')
  );

  // Show/hide tracker based on active jobs
  useEffect(() => {
    setIsVisible(activeJobs.length > 0);
  }, [activeJobs.length]);

  const dismissJob = (jobId: string) => {
    setDismissedJobs(prev => new Set(prev).add(jobId));
  };

  const dismissAll = () => {
    const allJobIds = activeJobs.map(job => job.jobId);
    setDismissedJobs(prev => new Set([...Array.from(prev), ...allJobIds]));
  };

  const getProgressPercentage = (job: ImportJob) => {
    if (job.isComplete) return 100;
    if (job.total === 0) return 0;
    return Math.round((job.current / job.total) * 100);
  };

  const getStatusIcon = (job: ImportJob) => {
    if (job.error) return <XCircle className="h-4 w-4 text-red-500" />;
    if (job.isComplete) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  };

  const getStatusColor = (job: ImportJob) => {
    if (job.error) return 'destructive';
    if (job.isComplete) return 'default';
    return 'secondary';
  };

  const formatTableName = (tableName: string) => {
    const names: Record<string, string> = {
      'reference-sheet': 'Reference Sheet',
      'transfer-items': 'Transfer Items',
      'stock-opname-items': 'Stock Opname',
      'staff': 'Staff',
      'stores': 'Stores',
      'pricelist': 'Price List'
    };
    return names[tableName] || tableName;
  };

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-50 w-96 transition-all duration-300",
        isCollapsed ? "h-14" : "max-h-96"
      )}
      data-testid="background-import-tracker"
    >
      <Card className="shadow-lg border-2 bg-background/95 backdrop-blur-sm">
        <CardHeader 
          className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileUp className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">
                Import Progress ({activeJobs.length})
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(!isCollapsed);
                }}
                className="h-6 w-6 p-0"
              >
                {isCollapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissAll();
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="pt-0 space-y-3 max-h-80 overflow-y-auto">
            {activeJobs.map((job) => (
              <div 
                key={job.jobId} 
                className="space-y-2 p-3 rounded-lg bg-muted/30 border"
                data-testid={`import-job-${job.jobId.slice(0, 8)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job)}
                    <span className="font-medium text-sm">
                      {formatTableName(job.tableName)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(job)} className="text-xs">
                      {job.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissJob(job.jobId)}
                      className="h-5 w-5 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{job.stage}</span>
                    <span>{job.current.toLocaleString()} / {job.total.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={getProgressPercentage(job)} 
                    className="h-2"
                  />
                  <div className="text-center text-xs text-muted-foreground">
                    {getProgressPercentage(job)}%
                  </div>
                </div>

                {/* Performance metrics */}
                {(job.throughputRps || job.eta) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {job.throughputRps && (
                      <span>⚡ {Math.round(job.throughputRps).toLocaleString()} rows/sec</span>
                    )}
                    {job.eta && (
                      <span>⏱️ ETA: {Math.round(job.eta)}s</span>
                    )}
                  </div>
                )}

                {job.error && (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                    {job.error}
                  </div>
                )}

                {job.isComplete && (
                  <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                    Import completed successfully!
                  </div>
                )}

                <div className="text-xs text-muted-foreground font-mono">
                  Job: {job.jobId.substring(0, 8)}...
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}