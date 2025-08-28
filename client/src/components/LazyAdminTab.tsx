import { memo, Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load individual tab components to reduce initial bundle size
const ReferenceSheetTab = lazy(() => import('@/components/admin/ReferenceSheetTab'));
const StoresTab = lazy(() => import('@/components/admin/StoresTab'));
const PositionsTab = lazy(() => import('@/components/admin/PositionsTab'));
const StaffTab = lazy(() => import('@/components/admin/StaffTab'));
const DiscountsTab = lazy(() => import('@/components/admin/DiscountsTab'));
const EdcTab = lazy(() => import('@/components/admin/EdcTab'));

interface LazyAdminTabProps {
  activeTab: string;
  searchQueries: Record<string, string>;
  onSearchChange: (tab: string, query: string) => void;
  selectedItems: Set<string>;
  onSelectAll: (checked: boolean, data: any[], config: any) => void;
  onSelectItem: (itemId: string, checked: boolean) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onImport: () => void;
  onAdd: () => void;
}

// Loading skeleton for tab content
const TabSkeleton = memo(() => (
  <div className="space-y-4 p-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
    <Skeleton className="h-10 w-full" />
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
));

TabSkeleton.displayName = 'TabSkeleton';

export const LazyAdminTab = memo<LazyAdminTabProps>(({
  activeTab,
  searchQueries,
  onSearchChange,
  selectedItems,
  onSelectAll,
  onSelectItem,
  onEdit,
  onDelete,
  onImport,
  onAdd,
}) => {
  const renderTabContent = () => {
    const commonProps = {
      searchQuery: searchQueries[activeTab] || '',
      onSearchChange: (query: string) => onSearchChange(activeTab, query),
      selectedItems,
      onSelectAll,
      onSelectItem,
      onEdit,
      onDelete,
      onImport,
      onAdd,
    };

    switch (activeTab) {
      case 'reference-sheet':
        return <ReferenceSheetTab {...commonProps} />;
      case 'stores':
        return <StoresTab {...commonProps} />;
      case 'positions':
        return <PositionsTab {...commonProps} />;
      case 'staff':
        return <StaffTab {...commonProps} />;
      case 'discounts':
        return <DiscountsTab {...commonProps} />;
      case 'edc':
        return <EdcTab {...commonProps} />;
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <Suspense fallback={<TabSkeleton />}>
      {renderTabContent()}
    </Suspense>
  );
});

LazyAdminTab.displayName = 'LazyAdminTab';