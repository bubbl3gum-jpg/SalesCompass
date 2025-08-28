import { memo, useMemo, useCallback } from 'react';
import { FixedSizeList as List, areEqual } from 'react-window';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Edit3, Trash2 } from 'lucide-react';

interface TableConfig {
  keyField: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
  }>;
}

interface OptimizedDataTableProps {
  data: any[];
  config: TableConfig;
  selectedItems: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectItem: (itemId: string, checked: boolean) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  height?: number;
  itemHeight?: number;
}

// Memoized row component to prevent unnecessary re-renders
const TableRow = memo(({ index, style, data }: any) => {
  const { items, config, selectedItems, onSelectItem, onEdit, onDelete } = data;
  const item = items[index];
  const itemId = item[config.keyField];
  const isSelected = selectedItems.has(itemId);

  return (
    <div style={style} className="flex items-center border-b px-4 hover:bg-muted/50">
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelectItem(itemId, checked as boolean)}
        className="mr-4"
      />
      {config.fields.slice(0, 4).map((field) => {
        const value = item[field.key];
        let displayValue = '-';
        
        if (field.type === 'password') {
          displayValue = '••••••••';
        } else if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            displayValue = Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
          } else {
            displayValue = String(value);
          }
        }
        
        return (
          <div key={String(field.key)} className="flex-1 px-2 truncate">
            {displayValue}
          </div>
        );
      })}
      <div className="flex gap-2 ml-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(item)}
          className="h-8 w-8 p-0"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(item)}
          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export const OptimizedDataTable = memo<OptimizedDataTableProps>(({
  data,
  config,
  selectedItems,
  onSelectAll,
  onSelectItem,
  onEdit,
  onDelete,
  height = 400,
  itemHeight = 50,
}) => {
  const allSelected = useMemo(() => 
    data.length > 0 && data.every(item => selectedItems.has(item[config.keyField])),
    [data, selectedItems, config.keyField]
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    onSelectAll(checked);
  }, [onSelectAll]);

  const itemData = useMemo(() => ({
    items: data,
    config,
    selectedItems,
    onSelectItem,
    onEdit,
    onDelete,
  }), [data, config, selectedItems, onSelectItem, onEdit, onDelete]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex items-center border-b px-4 py-3 bg-muted/50 font-medium">
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
          className="mr-4"
        />
        {config.fields.slice(0, 4).map((field) => (
          <div key={field.key} className="flex-1 px-2">
            {field.label}
          </div>
        ))}
        <div className="w-20 text-center">Actions</div>
      </div>

      {/* Virtual list for performance */}
      <List
        height={height}
        itemCount={data.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smoother scrolling
      >
        {TableRow}
      </List>
    </div>
  );
});

OptimizedDataTable.displayName = 'OptimizedDataTable';