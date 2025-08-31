import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useStoreAuth } from './useStoreAuth';

interface GlobalStoreContextType {
  selectedStore: string;
  setSelectedStore: (store: string) => void;
  clearSelectedStore: () => void;
  shouldUseGlobalStore: boolean;
}

const GlobalStoreContext = createContext<GlobalStoreContextType | undefined>(undefined);

interface GlobalStoreProviderProps {
  children: ReactNode;
}

export function GlobalStoreProvider({ children }: GlobalStoreProviderProps) {
  const { user } = useStoreAuth();
  const [selectedStore, setSelectedStoreState] = useState<string>('');

  // Check if user has "all store" permission
  const shouldUseGlobalStore = Boolean(user?.can_access_all_stores);

  // Load saved store selection from localStorage on mount
  useEffect(() => {
    if (shouldUseGlobalStore) {
      const savedStore = localStorage.getItem('global_selected_store');
      if (savedStore) {
        setSelectedStoreState(savedStore);
      }
    }
  }, [shouldUseGlobalStore]);

  // Save store selection to localStorage when it changes
  const setSelectedStore = (store: string) => {
    setSelectedStoreState(store);
    if (shouldUseGlobalStore) {
      localStorage.setItem('global_selected_store', store);
    }
  };

  // Clear store selection
  const clearSelectedStore = () => {
    setSelectedStoreState('');
    localStorage.removeItem('global_selected_store');
  };

  // Clear stored selection if user loses all-store permission
  useEffect(() => {
    if (!shouldUseGlobalStore) {
      clearSelectedStore();
    }
  }, [shouldUseGlobalStore]);

  return (
    <GlobalStoreContext.Provider
      value={{
        selectedStore,
        setSelectedStore,
        clearSelectedStore,
        shouldUseGlobalStore,
      }}
    >
      {children}
    </GlobalStoreContext.Provider>
  );
}

export function useGlobalStore() {
  const context = useContext(GlobalStoreContext);
  if (!context) {
    throw new Error('useGlobalStore must be used within a GlobalStoreProvider');
  }
  return context;
}