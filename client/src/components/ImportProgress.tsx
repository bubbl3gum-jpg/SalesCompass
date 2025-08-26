import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ImportProgressProps {
  importId: string | null;
  onComplete?: () => void;
}

interface ProgressData {
  current: number;
  total: number;
  status: string;
}

export function ImportProgress({ importId, onComplete }: ImportProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/import/progress/${importId}`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          
          if (data.status === 'Completed!' || data.status.includes('Completed')) {
            setIsComplete(true);
            if (onComplete) {
              setTimeout(onComplete, 1000); // Wait 1 second before calling onComplete
            }
          }
        } else if (response.status === 404) {
          // Import completed and cleaned up
          setIsComplete(true);
          if (onComplete) {
            onComplete();
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
        setError('Failed to fetch progress');
      }
    };

    // Poll every 500ms
    const interval = setInterval(pollProgress, 500);

    // Initial poll
    pollProgress();

    return () => clearInterval(interval);
  }, [importId, onComplete]);

  if (!importId || !progress) {
    return null;
  }

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="w-full space-y-4 p-4 border rounded-lg bg-card" data-testid="import-progress">
      <div className="flex items-center space-x-2">
        {isComplete ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : error ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        <span className="font-medium">
          {isComplete ? 'Import Complete!' : error ? 'Import Failed' : 'Importing...'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span data-testid="progress-status">{progress.status}</span>
          <span data-testid="progress-counter">
            {progress.current} / {progress.total}
          </span>
        </div>
        <Progress 
          value={progressPercentage} 
          className="w-full" 
          data-testid="progress-bar"
        />
        <div className="text-center text-sm text-muted-foreground">
          {Math.round(progressPercentage)}%
        </div>
      </div>
      
      {isComplete && (
        <div className="text-sm text-green-600 dark:text-green-400">
          Data import completed successfully!
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}