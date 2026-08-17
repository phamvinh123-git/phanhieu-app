"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { RoleCode } from "@/lib/rbac-config";

export type MeRole = {
  role: RoleCode;
  label: string;
  departmentId: number | null;
  departmentName: string | null;
};

export type MeNavItem = { href: string; label: string; icon: string; module: string };

export type MeData = {
  user: { id: string; fullName: string; email: string } | null;
  roles: MeRole[];
  nav: MeNavItem[];
};

const MeContext = createContext<{ me: MeData | null; loading: boolean; refresh: () => void }>({
  me: null,
  loading: true,
  refresh: () => {},
});

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setMe(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <MeContext.Provider value={{ me, loading, refresh: load }}>{children}</MeContext.Provider>;
}

export function useMe() {
  return useContext(MeContext);
}
