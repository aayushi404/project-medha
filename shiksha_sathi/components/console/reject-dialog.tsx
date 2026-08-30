"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  /** a single element (e.g. a <Button>) that base-ui wires the open handler onto */
  trigger: ReactElement;
  /** name of the person being rejected, for the dialog copy */
  subjectName: string;
  onConfirm: (reason: string) => Promise<void> | void;
};

/**
 * Rejection always needs a reason -- a teacher told only "rejected" will just
 * re-register and recreate the problem. The confirm button stays disabled
 * until the reason is long enough for the backend (min 3 chars).
 */
export function RejectDialog({ trigger, subjectName, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = reason.trim().length >= 3;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="text-base font-medium">
            Reject {subjectName}?
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            They&apos;ll see this reason and can register again. Be specific.
          </Dialog.Description>

          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Employee code doesn't match our staff records."
            className="mt-3 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={submit}
              disabled={!valid || busy}
            >
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
