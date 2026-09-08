"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useWorkUpdates, type SchoolNotice } from "@/lib/work-update-store";

export function PrincipalNoticeBoard() {
  const { notices, addNotice, deleteNotice } = useWorkUpdates();
  const { teacher } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<SchoolNotice["target_audience"]>("all");
  const [priority, setPriority] = useState<SchoolNotice["priority"]>("normal");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Please enter a title and notice message.");
      return;
    }
    addNotice({
      title: title.trim(),
      message: message.trim(),
      target_audience: audience,
      priority,
      posted_by: teacher?.full_name ? `${teacher.full_name} (Principal)` : "Dr. Rajeshwar Singh (Principal)",
    });
    toast.success("School Notice broadcasted successfully! 📢");
    setTitle("");
    setMessage("");
    setShowModal(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Megaphone className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Official School Notice Board (सूचना पट्ट)</h3>
            <p className="text-[11px] text-muted-foreground">Broadcast alerts directly to teachers and students</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowModal(true)}
          className="h-8 gap-1.5 bg-terracotta text-white hover:bg-terracotta/90 text-xs"
        >
          <Plus className="size-3.5" />
          New Circular
        </Button>
      </div>

      {/* Notices Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {notices.map((n) => {
          const isUrgent = n.priority === "urgent";
          return (
            <div
              key={n.id}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                isUrgent
                  ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                  : "border-border bg-card"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isUrgent && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        <AlertCircle className="size-3" /> URGENT
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                      {n.target_audience === "all"
                        ? "All (सभी)"
                        : n.target_audience === "teachers"
                        ? "Teachers Only"
                        : "Students Only"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      deleteNotice(n.id);
                      toast.success("Notice removed.");
                    }}
                    className="text-muted-foreground/60 hover:text-rose-600 transition-colors"
                    title="Delete notice"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <h4 className="mt-2 text-xs font-semibold text-foreground leading-snug">{n.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {n.message}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/80">{n.posted_by}</span>
                <span>{new Date(n.posted_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl text-card-foreground">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-3.5 top-3.5 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <Megaphone className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Post Official Circular / Notice</h3>
                <p className="text-[11px] text-muted-foreground">Will appear instantly on Teacher & Student screens</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-foreground">Notice Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Science Diagnostic Exam Schedule..."
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-terracotta focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Notice Details / Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the message or instructions clearly..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-terracotta focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as SchoolNotice["target_audience"])}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="all">Everyone (Teachers + Students)</option>
                    <option value="teachers">Teachers Only</option>
                    <option value="students">Students Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-foreground">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as SchoolNotice["priority"])}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="normal">Normal Circular</option>
                    <option value="urgent">Urgent Announcement</option>
                    <option value="event">School Event / PTM</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-terracotta text-white hover:bg-terracotta/90 gap-1">
                  <Send className="size-3" />
                  Broadcast Notice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
