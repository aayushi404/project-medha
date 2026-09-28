/**
 * CSV parsing for the principal's bulk student import. Everything here is
 * forgiving about *format* (Excel quirks, header wording, Hindi headers) and
 * leaves judging the *values* to the backend, which validates every row and
 * reports problems against the same line numbers computed here.
 */
import type { StudentImportRow, StudentImportRowResult } from "@/lib/api";

type Field = Exclude<keyof StudentImportRow, "line">;

/** Header spellings we accept, compared after `normalizeHeader`. */
const HEADER_ALIASES: Record<Field, string[]> = {
  full_name: [
    "name", "fullname", "studentname", "student", "studentfullname", "nameofstudent",
    "नाम", "छात्रकानाम", "विद्यार्थीकानाम", "छात्र", "विद्यार्थी",
  ],
  grade: ["class", "grade", "std", "standard", "classname", "कक्षा"],
  roll_number: [
    "roll", "rollno", "rollnumber", "rollnum", "rollnos",
    "रोल", "रोलनंबर", "रोलनं", "क्रमांक",
  ],
  guardian_name: [
    "guardianname", "guardian", "parentname", "parent", "fathername", "mothername",
    "अभिभावक", "अभिभावककानाम", "पिताकानाम", "माताकानाम",
  ],
  guardian_relation: ["relation", "relationship", "guardianrelation", "संबंध", "रिश्ता"],
  guardian_phone: [
    "guardianphone", "guardianmobile", "parentphone", "parentmobile", "fatherphone",
    "fathermobile", "phone", "phoneno", "phonenumber", "mobile", "mobileno",
    "mobilenumber", "contact", "contactno", "contactnumber",
    "मोबाइल", "मोबाइलनंबर", "फोन", "फ़ोन", "फोननंबर",
  ],
};

export const REQUIRED_FIELDS: Field[] = ["full_name", "grade", "roll_number"];

export const FIELD_LABELS: Record<Field, string> = {
  full_name: "Name",
  grade: "Class",
  roll_number: "Roll No",
  guardian_name: "Guardian Name",
  guardian_relation: "Relation",
  guardian_phone: "Guardian Phone",
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function normalizeHeader(h: string): string {
  return h.normalize("NFC").toLowerCase().replace(/[\s._\-()#:/'"]+/g, "");
}

/**
 * Decode as UTF-8, falling back to Windows-1252 for files saved with Excel's
 * plain "CSV" (not "CSV UTF-8") option -- that encoding can't hold Hindi, so
 * such files are English-only and decode correctly this way.
 */
async function decode(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return text.replace(/^﻿/, "");
}

/** Pick the delimiter that splits the header line the most. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 parse. Each record carries the line it started on. */
function parseRecords(text: string, delimiter: string): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    cells.push(cell);
    records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      cell = "";
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return records;
}

export type ParsedStudentCsv =
  | { ok: true; rows: StudentImportRow[]; mapped: Field[]; ignored: string[] }
  | { ok: false; error: string };

export async function parseStudentCsv(file: File): Promise<ParsedStudentCsv> {
  if (file.size === 0) return { ok: false, error: "This file is empty." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "This file is larger than 2 MB. Split it into smaller files." };
  }

  // an .xlsx is a zip ("PK..."), which would decode as garbage
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) {
    return {
      ok: false,
      error: "This looks like an Excel file. In Excel, use File → Save As → “CSV UTF-8”, then upload that.",
    };
  }

  const text = await decode(file);
  const records = parseRecords(text, detectDelimiter(text)).filter((r) =>
    r.cells.some((c) => c.trim() !== ""),
  );
  if (records.length === 0) return { ok: false, error: "This file is empty." };

  const [header, ...body] = records;
  const columnOf: Partial<Record<Field, number>> = {};
  const ignored: string[] = [];
  header.cells.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find((f) =>
      HEADER_ALIASES[f].includes(key),
    );
    if (field && columnOf[field] === undefined) columnOf[field] = idx;
    else if (raw.trim()) ignored.push(raw.trim());
  });

  const missing = REQUIRED_FIELDS.filter((f) => columnOf[f] === undefined);
  if (missing.length > 0) {
    const found = header.cells.map((c) => c.trim()).filter(Boolean);
    return {
      ok: false,
      error:
        `Couldn't find the ${missing.map((f) => `“${FIELD_LABELS[f]}”`).join(", ")} ` +
        `column${missing.length > 1 ? "s" : ""}. The first row must be the column headings` +
        (found.length ? ` — this file's first row is: ${found.slice(0, 6).join(", ")}.` : "."),
    };
  }
  if (body.length === 0) {
    return { ok: false, error: "The file has headings but no students under them." };
  }

  // "Father Name" with no Relation column already says who the guardian is
  const headerKeyOf = (f: Field) =>
    columnOf[f] === undefined ? "" : normalizeHeader(header.cells[columnOf[f]!]);
  const guardianKey = headerKeyOf("guardian_name");
  const impliedRelation =
    columnOf.guardian_relation !== undefined
      ? null
      : /father|पिता/.test(guardianKey)
        ? "father"
        : /mother|माता/.test(guardianKey)
          ? "mother"
          : null;

  const get = (cells: string[], f: Field): string | null => {
    const idx = columnOf[f];
    const v = idx === undefined ? "" : (cells[idx] ?? "").trim();
    return v === "" ? null : v;
  };

  const rows: StudentImportRow[] = body.map(({ line, cells }) => {
    const guardianName = get(cells, "guardian_name");
    return {
      line,
      full_name: get(cells, "full_name"),
      grade: get(cells, "grade"),
      roll_number: get(cells, "roll_number"),
      guardian_name: guardianName,
      guardian_relation:
        get(cells, "guardian_relation") ?? (guardianName ? impliedRelation : null),
      guardian_phone: get(cells, "guardian_phone"),
    };
  });

  return {
    ok: true,
    rows,
    mapped: (Object.keys(columnOf) as Field[]).filter((f) => columnOf[f] !== undefined),
    ignored,
  };
}

// --- writing CSVs (template + result report) ---

function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // keep a name like "=cmd|..." from running as a formula when opened in Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function saveCsv(filename: string, rows: (string | number | null)[][]): void {
  // BOM so Excel opens it as UTF-8 and Hindi names survive
  const text = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Headings only -- sample rows in a template tend to get imported by mistake. */
export function downloadStudentTemplate(): void {
  saveCsv("medha-students-template.csv", [
    (Object.keys(FIELD_LABELS) as Field[]).map((f) => FIELD_LABELS[f]),
  ]);
}

const STATUS_LABELS: Record<StudentImportRowResult["status"], string> = {
  ready: "Ready",
  created: "Created",
  exists: "Already on Medha",
  error: "Needs fixing",
};

export function downloadImportReport(rows: StudentImportRowResult[]): void {
  saveCsv("medha-student-import-report.csv", [
    ["Line", "Name", "Class", "Roll No", "Status", "Details"],
    ...rows.map((r) => [
      r.line,
      r.full_name,
      r.grade_label,
      r.roll_number,
      STATUS_LABELS[r.status],
      r.message,
    ]),
  ]);
}
