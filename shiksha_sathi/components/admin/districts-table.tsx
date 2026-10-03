"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getAdminDistricts, type DistrictSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function DistrictsTable() {
  const { accessToken } = useAuth();
  const [districts, setDistricts] = useState<DistrictSummary[] | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getAdminDistricts(accessToken)
      .then((d) => {
        if (active) setDistricts(d);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load districts.");
        if (active) setDistricts([]);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (districts === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (districts.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No districts yet.
      </p>
    );
  }

  const num = "px-4 py-2.5 text-right tabular-nums";
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">District</th>
            <th className={`${num} font-medium`}>Schools</th>
            <th className={`${num} font-medium`}>Teachers</th>
            <th className={`${num} font-medium`}>Students</th>
            <th className={`${num} font-medium`}>No principal</th>
            <th className={`${num} font-medium`}>Pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {districts.map((d) => (
            <tr key={d.district_id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link
                  href={`/admin/schools?district=${d.district_id}`}
                  className="font-medium text-foreground hover:text-terracotta hover:underline"
                >
                  {d.district_name}
                </Link>
              </td>
              <td className={num}>{d.schools}</td>
              <td className={num}>{d.teachers}</td>
              <td className={num}>{d.students}</td>
              <td className={num}>
                {d.schools_without_principal > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {d.schools_without_principal}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
              <td className={num}>{d.pending_principals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
