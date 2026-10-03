"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  getAdminDistricts,
  getAdminSchools,
  type DistrictSummary,
  type SchoolPrincipalStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { SchoolsList } from "@/components/admin/schools-list";

/** Searchable, district-filterable list of every school. `initialDistrictId`
 * lets the Districts page deep-link here (`/admin/schools?district=<id>`). */
export function SchoolsBrowser({ initialDistrictId }: { initialDistrictId?: string }) {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [districtId, setDistrictId] = useState(initialDistrictId ?? "");
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [schools, setSchools] = useState<SchoolPrincipalStatus[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = `${districtId}|${q}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    if (!accessToken) return;
    getAdminDistricts(accessToken)
      .then(setDistricts)
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getAdminSchools(accessToken, { q, districtId: districtId || undefined })
      .then((rows) => {
        if (!active) return;
        setSchools(rows);
        setLoadedKey(`${districtId}|${q}`);
      })
      .catch((e: unknown) => {
        if (!active) return;
        toast.error(e instanceof Error ? e.message : "Could not load schools.");
        setLoadedKey(`${districtId}|${q}`);
      });
    return () => {
      active = false;
    };
  }, [accessToken, q, districtId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name or UDISE code"
            className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <select
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          aria-label="Filter by district"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d.district_id} value={d.district_id}>
              {d.district_name}
            </option>
          ))}
        </select>
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {schools.length} {schools.length === 1 ? "school" : "schools"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SchoolsList schools={schools} />
      )}
    </div>
  );
}
