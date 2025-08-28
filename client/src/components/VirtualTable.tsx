import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { useInView } from 'react-intersection-observer';

interface VirtualTableProps {
  data: any[];
  rowHeight?: number;
  visibleRows?: number;
  renderRow: (item: any, index: number) => React.ReactNode;
  renderHeader: () => React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const VirtualTable = memo(({
  data,
  rowHeight = 50,
  visibleRows = 20,
  renderRow,
  renderHeader,
  onLoadMore,
  hasMore = false,
}: VirtualTableProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
  });

  // Calculate visible range
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.min(startIndex + visibleRows, data.length);
  const visibleItems = data.slice(startIndex, endIndex);
  const totalHeight = data.length * rowHeight;
  const offsetY = startIndex * rowHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Load more when reaching bottom
  useEffect(() => {
    if (inView && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasMore, onLoadMore]);

  return (
    <div className="relative">
      {renderHeader()}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: visibleRows * rowHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleItems.map((item, index) => (
              <div
                key={startIndex + index}
                style={{ height: rowHeight }}
                className="border-b"
              >
                {renderRow(item, startIndex + index)}
              </div>
            ))}
          </div>
          {hasMore && (
            <div
              ref={loadMoreRef}
              style={{
                position: 'absolute',
                bottom: 0,
                height: 1,
                width: '100%',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
});

VirtualTable.displayName = 'VirtualTable';