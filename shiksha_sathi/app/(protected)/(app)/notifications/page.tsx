"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getProfile,
  listNotifications,
  markNotificationRead,
  type AppNotification,
  type Profile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { AnnounceForm } from "@/components/notifications/announce-form";
import { NotificationList } from "@/components/notifications/notification-list";

export default function TeacherNotificationsPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    return Promise.all([listNotifications(accessToken), getProfile(accessToken)])
      .then(([n, p]) => {
        setItems(n);
        setProfile(p);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load notifications.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function onOpen(n: AppNotification) {
    if (n.read_at) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    try {
      await markNotificationRead(accessToken, n.id);
    } catch {
      /* leave the optimistic read state -- not worth reverting */
    }
  }

  const grades = Array.from(
    new Map((profile?.subjects ?? []).map((s) => [s.grade_id, s.grade_label])).entries(),
  ).map(([value, label]) => ({ value, label }));

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.notifications.title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <AnnounceForm target={{ kind: "grade", grades }} onSent={() => void reload()} />
              <NotificationList items={items} onOpen={(n) => void onOpen(n)} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
