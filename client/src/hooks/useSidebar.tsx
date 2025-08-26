import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const setSidebarExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
  }, []);

  const value = useMemo(() => ({
    isExpanded,
    toggleSidebar,
    setSidebarExpanded
  }), [isExpanded, toggleSidebar, setSidebarExpanded]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}