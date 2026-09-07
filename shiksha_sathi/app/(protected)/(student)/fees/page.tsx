"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { listFees, type FeePayment } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { FeesList } from "@/components/fees/fees-list";

export default function StudentFeesPage() {
  const { accessToken, teacher } = useAuth();
  const copy = useCopy();
  const t = copy.feesPage;

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !teacher) return;
    let active = true;
    listFees(accessToken, teacher.id)
      .then((r) => active && setPayments(r))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, teacher]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{t.studentTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.studentSub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto w-full max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <FeesList payments={payments} />
          )}
        </div>
      </div>
    </main>
  );
}
