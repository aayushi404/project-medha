"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { announce } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SelectOption } from "@/components/ui/select";
import { Select } from "@/components/ui/select";

type Target =
  | { kind: "grade"; grades: SelectOption[] }
  | { kind: "audience" };

export function AnnounceForm({ target, onSent }: { target: Target; onSent?: () => void }) {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const [gradeId, setGradeId] = useState<string | null>(
    target.kind === "grade" ? (target.grades[0]?.value ?? null) : null,
  );
  const [audience, setAudience] = useState<"teachers" | "students">("students");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (target.kind === "audience" || gradeId != null);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      const result = await announce(accessToken, {
        title: title.trim(),
        body: body.trim(),
        ...(target.kind === "grade" ? { grade_id: gradeId ?? undefined } : { audience }),
      });
      toast.success(copy.notifications.sentToast(result.recipients));
      setTitle("");
      setBody("");
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h3 className="text-sm font-medium text-foreground">{copy.notifications.announceTitle}</h3>
        <p className="text-xs text-muted-foreground">{copy.notifications.announceSub}</p>
      </div>

      {target.kind === "grade" ? (
        target.grades.length > 0 && (
          <Select
            value={gradeId}
            onValueChange={setGradeId}
            options={target.grades}
            className="w-full"
          />
        )
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={audience === "students" ? "default" : "outline"}
            onClick={() => setAudience("students")}
          >
            {copy.notifications.announceToStudents}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={audience === "teachers" ? "default" : "outline"}
            onClick={() => setAudience("teachers")}
          >
            {copy.notifications.announceToTeachers}
          </Button>
        </div>
      )}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={copy.notifications.titleLabel}
        maxLength={200}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={copy.notifications.messageLabel}
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <Button onClick={() => void submit()} disabled={!canSend || sending} className="self-start">
        <Send className="size-3.5" />
        {sending ? copy.notifications.sending : copy.notifications.sendBtn}
      </Button>
    </div>
  );
}
