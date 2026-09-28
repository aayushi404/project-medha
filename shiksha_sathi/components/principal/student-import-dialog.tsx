"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  importStudents,
  MAX_STUDENT_IMPORT_ROWS,
  type StudentImportResult,
  type StudentImportRow,
  type StudentImportRowStatus,
} from "@/lib/api";
import { useLocale } from "@/lib/copy";
import {
  downloadImportReport,
  downloadStudentTemplate,
  parseStudentCsv,
} from "@/lib/student-csv";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Step = "pick" | "checking" | "preview" | "importing" | "done";
type Filter = "all" | StudentImportRowStatus;

// rendering thousands of rows in a dialog gets sluggish on low-end phones;
// the downloadable report always has every row
const MAX_VISIBLE_ROWS = 200;

const COPY = {
  en: {
    trigger: "Import CSV",
    title: "Import students from a CSV",
    intro:
      "Create accounts for a whole class at once. Students choose their own passwords — you never hand any out.",
    drop: "Choose a CSV file or drag it here",
    dropHint: `Up to ${MAX_STUDENT_IMPORT_ROWS.toLocaleString("en-IN")} students · 2 MB`,
    columns: "Columns",
    required: "required",
    tip: "Class can be written as 8, Class 8, VIII or 8A. No Section column? Everyone goes to section A. Missing sections are created for you. Hindi headings (नाम, कक्षा, रोल नंबर) work too. Saving from Excel? Use “CSV UTF-8” so Hindi names stay intact.",
    template: "Download template",
    checking: (n: number) => `Checking ${n.toLocaleString("en-IN")} rows…`,
    another: "Choose another file",
    ready: "Ready to create",
    created: "Created",
    exists: "Already on Medha",
    errors: "Need fixing",
    all: "All",
    invited: (n: number) =>
      `${n.toLocaleString("en-IN")} will get an email to set their password. The rest claim their account with class, section and roll number.`,
    newSections: "New sections will be created:",
    year: "Academic year",
    skipNote:
      "Rows that need fixing will be skipped. Fix them in your file and upload it again anytime — students already created won't be duplicated.",
    ignored: "Ignored columns:",
    more: (n: number) => `…and ${n.toLocaleString("en-IN")} more. Download the report to see every row.`,
    report: "Download report",
    cancel: "Cancel",
    create: (n: number) => `Create ${n.toLocaleString("en-IN")} account${n === 1 ? "" : "s"}`,
    creating: "Creating accounts…",
    nothing: "Nothing new to create",
    doneTitle: (n: number) => `${n.toLocaleString("en-IN")} student account${n === 1 ? "" : "s"} created`,
    doneSkipped: (exists: number, errors: number) =>
      [
        exists ? `${exists} already on Medha` : null,
        errors ? `${errors} skipped because they need fixing` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    nextTitle: "What students do next",
    nextEmail: (n: number) =>
      `${n.toLocaleString("en-IN")} student${n === 1 ? " has" : "s have"} been emailed a link to set a password (valid 7 days). If it expires, “Forgot password” works.`,
    nextClaim: [
      "Students without an email: open Medha and choose Student → “Claim your account”.",
      "They enter school, class, section, roll number and name exactly as in your list.",
      "They add their own email and password — then they can log in.",
    ],
    claimLink: "Share this page with them:",
    done: "Done",
    emptyFilter: "No rows here.",
    line: "Line",
    roll: "Roll",
  },
  hi: {
    trigger: "CSV आयात",
    title: "CSV से विद्यार्थी जोड़ें",
    intro:
      "पूरी कक्षा के खाते एक साथ बनाएँ। विद्यार्थी अपना पासवर्ड खुद बनाएँगे — आपको कोई पासवर्ड नहीं बाँटना।",
    drop: "CSV फ़ाइल चुनें या यहाँ खींचकर छोड़ें",
    dropHint: `अधिकतम ${MAX_STUDENT_IMPORT_ROWS.toLocaleString("en-IN")} विद्यार्थी · 2 MB`,
    columns: "कॉलम",
    required: "ज़रूरी",
    tip: "कक्षा 8, Class 8, VIII या 8A — किसी भी तरह लिखें। सेक्शन कॉलम न हो तो सब सेक्शन A में जाएँगे। जो सेक्शन नहीं है वह अपने आप बन जाएगा। हिंदी शीर्षक (नाम, कक्षा, रोल नंबर) भी चलेंगे। Excel से सेव करते समय “CSV UTF-8” चुनें।",
    template: "टेम्पलेट डाउनलोड करें",
    checking: (n: number) => `${n.toLocaleString("en-IN")} पंक्तियाँ जाँची जा रही हैं…`,
    another: "दूसरी फ़ाइल चुनें",
    ready: "बनने को तैयार",
    created: "बन गया",
    exists: "पहले से मेधा पर",
    errors: "सुधार ज़रूरी",
    all: "सभी",
    invited: (n: number) =>
      `${n.toLocaleString("en-IN")} को पासवर्ड बनाने का ईमेल जाएगा। बाकी कक्षा, सेक्शन और रोल नंबर से अपना खाता क्लेम करेंगे।`,
    newSections: "ये नए सेक्शन बनेंगे:",
    year: "शैक्षणिक सत्र",
    skipNote:
      "जिन पंक्तियों में सुधार ज़रूरी है, वे छोड़ दी जाएँगी। फ़ाइल ठीक करके कभी भी दोबारा अपलोड करें — पहले बने खाते दोबारा नहीं बनेंगे।",
    ignored: "छोड़े गए कॉलम:",
    more: (n: number) => `…और ${n.toLocaleString("en-IN")} पंक्तियाँ। सभी देखने के लिए रिपोर्ट डाउनलोड करें।`,
    report: "रिपोर्ट डाउनलोड करें",
    cancel: "रद्द करें",
    create: (n: number) => `${n.toLocaleString("en-IN")} खाते बनाएँ`,
    creating: "खाते बन रहे हैं…",
    nothing: "बनाने को कुछ नया नहीं",
    doneTitle: (n: number) => `${n.toLocaleString("en-IN")} विद्यार्थी खाते बन गए`,
    doneSkipped: (exists: number, errors: number) =>
      [
        exists ? `${exists} पहले से मेधा पर` : null,
        errors ? `${errors} सुधार ज़रूरी होने से छोड़े गए` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    nextTitle: "अब विद्यार्थी क्या करें",
    nextEmail: (n: number) =>
      `${n.toLocaleString("en-IN")} विद्यार्थियों को पासवर्ड बनाने का लिंक ईमेल हो गया है (7 दिन मान्य)। समाप्त होने पर “Forgot password” चलेगा।`,
    nextClaim: [
      "बिना ईमेल वाले विद्यार्थी: मेधा खोलें, Student चुनें → “Claim your account”।",
      "स्कूल, कक्षा, सेक्शन, रोल नंबर और नाम ठीक वैसे ही भरें जैसे आपकी सूची में हैं।",
      "अपना ईमेल और पासवर्ड बनाएँ — फिर लॉग इन कर सकते हैं।",
    ],
    claimLink: "उन्हें यह पेज बताएँ:",
    done: "पूर्ण",
    emptyFilter: "यहाँ कोई पंक्ति नहीं।",
    line: "पंक्ति",
    roll: "रोल",
  },
};

const COLUMN_GUIDE: { name: string; required: boolean; example: string }[] = [
  { name: "Name", required: true, example: "Ravi Kumar" },
  { name: "Class", required: true, example: "8" },
  { name: "Section", required: false, example: "A" },
  { name: "Roll No", required: true, example: "12" },
  { name: "Admission No", required: false, example: "2026/104" },
  { name: "Email", required: false, example: "ravi@example.com" },
  { name: "Guardian Name", required: false, example: "Suresh Kumar" },
  { name: "Relation", required: false, example: "Father" },
  { name: "Guardian Phone", required: false, example: "9876543210" },
];

const STATUS_STYLE: Record<StudentImportRowStatus, string> = {
  ready: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  created: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  exists: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

type Props = {
  token: string | null;
  /** called after accounts were created, so the dashboard can refresh */
  onImported: () => void;
};

export function StudentImportDialog({ token, onImported }: Props) {
  const { locale } = useLocale();
  const t = COPY[locale === "hi" ? "hi" : "en"];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  // bumped on reset/close so a response for an abandoned file is dropped
  const runId = useRef(0);

  const busy = step === "checking" || step === "importing";

  function reset() {
    runId.current++;
    setStep("pick");
    setDragging(false);
    setFileName(null);
    setParseError(null);
    setRows([]);
    setIgnored([]);
    setResult(null);
    setFilter("all");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onOpenChange(next: boolean) {
    if (!next && busy) return; // don't abandon an import mid-flight
    setOpen(next);
    if (!next) reset();
  }

  async function preview(parsedRows: StudentImportRow[]) {
    const id = ++runId.current;
    setStep("checking");
    try {
      const res = await importStudents(token, parsedRows, true);
      if (id !== runId.current) return;
      setResult(res);
      setFilter(res.errors > 0 ? "error" : "all");
      setStep("preview");
    } catch (e) {
      if (id !== runId.current) return;
      setParseError(e instanceof Error ? e.message : "Could not check the file.");
      setStep("pick");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    reset();
    const id = runId.current;
    setFileName(file.name);
    const parsed = await parseStudentCsv(file);
    if (id !== runId.current) return; // dialog closed or another file picked
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    if (parsed.rows.length > MAX_STUDENT_IMPORT_ROWS) {
      setParseError(
        `This file has ${parsed.rows.length.toLocaleString("en-IN")} students; the limit is ` +
          `${MAX_STUDENT_IMPORT_ROWS.toLocaleString("en-IN")} per upload. Split it into smaller files.`,
      );
      return;
    }
    setRows(parsed.rows);
    setIgnored(parsed.ignored);
    await preview(parsed.rows);
  }

  async function commit() {
    if (!result || result.ready === 0) return;
    const id = ++runId.current;
    setStep("importing");
    try {
      const res = await importStudents(token, rows, false);
      if (id !== runId.current) return;
      setResult(res);
      setStep("done");
      onImported();
    } catch (e) {
      if (id !== runId.current) return;
      toast.error(e instanceof Error ? e.message : "Could not import students.");
      // nothing was saved (the import is all-or-nothing); re-check so the
      // preview reflects whatever changed on the roster meanwhile
      await preview(rows);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }

  const visibleRows =
    result?.rows.filter((r) =>
      filter === "all" ? true : filter === "ready" ? r.status === "ready" || r.status === "created" : r.status === filter,
    ) ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="size-3.5" />
            {t.trigger}
          </Button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {/* header */}
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{t.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {t.intro}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              aria-label={t.cancel}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {step === "pick" && (
              <div className="flex flex-col gap-4">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50",
                    dragging
                      ? "border-terracotta bg-terracotta/5"
                      : "border-border hover:border-terracotta/60 hover:bg-muted/40",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                    <FileSpreadsheet className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{t.drop}</span>
                  <span className="text-xs text-muted-foreground">{t.dropHint}</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                </label>

                {parseError && (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      {fileName && <div className="truncate font-medium">{fileName}</div>}
                      <div>{parseError}</div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                      {t.columns}
                    </span>
                    <Button variant="ghost" size="sm" onClick={downloadStudentTemplate}>
                      <Download className="size-3.5" />
                      {t.template}
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                    <table className="w-full min-w-[56rem] text-left text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          {COLUMN_GUIDE.map((c) => (
                            <th key={c.name} className="px-2.5 py-2 font-semibold text-foreground">
                              {c.name}
                              {c.required && <span className="text-terracotta"> *</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {COLUMN_GUIDE.map((c) => (
                            <td key={c.name} className="px-2.5 py-2 text-muted-foreground">
                              {c.example}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="text-terracotta">*</span> {t.required}. {t.tip}
                  </p>
                </div>
              </div>
            )}

            {(step === "checking" || step === "importing") && (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-terracotta" />
                {step === "checking" ? t.checking(rows.length) : t.creating}
              </div>
            )}

            {step === "preview" && result && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <FileSpreadsheet className="size-3.5 shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={reset}
                    className="shrink-0 font-medium text-terracotta hover:underline"
                  >
                    {t.another}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["ready", t.ready, result.ready, "text-emerald-600 dark:text-emerald-400"],
                      ["exists", t.exists, result.exists, "text-foreground"],
                      ["error", t.errors, result.errors, "text-destructive"],
                    ] as const
                  ).map(([key, label, count, tone]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(filter === key ? "all" : key)}
                      aria-pressed={filter === key}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-left ring-1 transition-colors",
                        filter === key
                          ? "bg-muted ring-foreground/25"
                          : "ring-foreground/10 hover:bg-muted/50",
                      )}
                    >
                      <div className={cn("text-xl font-semibold tabular-nums", count > 0 ? tone : "text-muted-foreground")}>
                        {count.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</div>
                    </button>
                  ))}
                </div>

                {result.ready > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground/85">
                    <span>
                      <span className="text-muted-foreground">{t.year}: </span>
                      {result.academic_year_label}
                    </span>
                    {result.new_sections.length > 0 && (
                      <span>
                        <span className="text-muted-foreground">{t.newSections} </span>
                        {result.new_sections.join(", ")}
                      </span>
                    )}
                    <span>{t.invited(result.invited)}</span>
                  </div>
                )}

                {result.errors > 0 && (
                  <p className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {t.skipNote}
                  </p>
                )}
                {ignored.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t.ignored} {ignored.join(", ")}
                  </p>
                )}

                <RowList rows={visibleRows} t={t} />
              </div>
            )}

            {step === "done" && result && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2 pt-2 text-center">
                  <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-lg font-semibold text-foreground">{t.doneTitle(result.created)}</div>
                  {(result.exists > 0 || result.errors > 0) && (
                    <div className="text-xs text-muted-foreground">
                      {t.doneSkipped(result.exists, result.errors)}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-foreground uppercase">
                    {t.nextTitle}
                  </div>
                  {result.invited > 0 && (
                    <p className="mb-3 text-sm text-foreground/90">{t.nextEmail(result.invited)}</p>
                  )}
                  {result.created > result.invited && (
                    <>
                      <ol className="flex flex-col gap-2 text-sm text-foreground/90">
                        {t.nextClaim.map((s, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-[11px] font-semibold text-terracotta">
                              {i + 1}
                            </span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t.claimLink}{" "}
                        <span className="font-medium text-foreground">
                          {typeof window !== "undefined" ? `${window.location.origin}/student/claim` : "/student/claim"}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* footer */}
          {(step === "preview" || step === "done") && result && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto"
                onClick={() => downloadImportReport(result.rows)}
              >
                <Download className="size-3.5" />
                {t.report}
              </Button>
              {step === "preview" ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    {t.cancel}
                  </Button>
                  <Button size="sm" onClick={() => void commit()} disabled={result.ready === 0}>
                    {result.ready === 0 ? t.nothing : t.create(result.ready)}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  {t.done}
                </Button>
              )}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RowList({
  rows,
  t,
}: {
  rows: StudentImportResult["rows"];
  t: (typeof COPY)["en"] | (typeof COPY)["hi"];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t.emptyFilter}</p>;
  }
  const statusLabel: Record<StudentImportRowStatus, string> = {
    ready: t.ready,
    created: t.created,
    exists: t.exists,
    error: t.errors,
  };
  return (
    <>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
        {rows.slice(0, MAX_VISIBLE_ROWS).map((r) => (
          <li key={r.line} className="flex gap-3 px-3 py-2.5">
            <span className="w-8 shrink-0 pt-0.5 text-right text-[11px] text-muted-foreground tabular-nums" title={t.line}>
              {r.line}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {r.full_name ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[r.class_label, r.roll_number ? `${t.roll} ${r.roll_number}` : null, r.email]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {r.message && (
                <div
                  className={cn(
                    "mt-0.5 text-xs",
                    r.status === "error" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {r.message}
                </div>
              )}
            </div>
            <span
              className={cn(
                "h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                STATUS_STYLE[r.status],
              )}
            >
              {statusLabel[r.status]}
            </span>
          </li>
        ))}
      </ul>
      {rows.length > MAX_VISIBLE_ROWS && (
        <p className="text-center text-xs text-muted-foreground">
          {t.more(rows.length - MAX_VISIBLE_ROWS)}
        </p>
      )}
    </>
  );
}
