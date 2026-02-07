"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  isCloud: boolean;
}

const AppContext = createContext<AppContextValue>({ isCloud: false });

export function AppProvider({
  isCloud,
  children,
}: {
  isCloud: boolean;
  children: React.ReactNode;
}) {
  return (
    <AppContext.Provider value={{ isCloud }}>{children}</AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
