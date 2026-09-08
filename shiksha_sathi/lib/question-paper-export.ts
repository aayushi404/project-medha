import type { AnswerKey, QuestionPaperContent } from "@/lib/generation-types";

export type QuestionPaperMeta = {
  subject?: string;
  grade?: string;
  teacher?: string;
  topic?: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function safeName(title: string, suffix = ""): string {
  const base =
    (title || "question-paper").replace(/[^\p{L}\p{N}\- _]+/gu, "").trim().slice(0, 80) ||
    "question-paper";
  return suffix ? `${base} - ${suffix}` : base;
}

// --- shared jsPDF flowing-text cursor ---------------------------------------

async function newDoc() {
  const { jsPDF } = await (import("jspdf" as string) as Promise<any>);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const wrapW = right - left;
  const state = { y: 56 };

  function ensure(space: number) {
    if (state.y + space > pageH - 48) {
      doc.addPage();
      state.y = 56;
    }
  }
  function write(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      italic?: boolean;
      gap?: number;
      align?: "center";
      x?: number;
      maxWidth?: number;
    } = {},
  ) {
    const { size = 11, bold = false, italic = false, gap = 4, align, x = left, maxWidth } = opts;
    doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    doc.setFontSize(size);
    const w = maxWidth ?? (align === "center" ? wrapW : right - x);
    const rows = doc.splitTextToSize(text, w) as string[];
    for (const r of rows) {
      ensure(size + gap);
      if (align === "center") doc.text(r, pageW / 2, state.y, { align: "center" });
      else doc.text(r, x, state.y);
      state.y += size + gap;
    }
  }
  /** MCQ choices in a 2-column grid, mirroring the SAVRA paper. */
  function options(opts: string[]) {
    const colW = wrapW / 2 - 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (let i = 0; i < opts.length; i += 2) {
      const rowsL = doc.splitTextToSize(`(${LETTERS[i]}) ${opts[i]}`, colW) as string[];
      const rowsR = opts[i + 1]
        ? (doc.splitTextToSize(`(${LETTERS[i + 1]}) ${opts[i + 1]}`, colW) as string[])
        : [];
      const h = Math.max(rowsL.length, rowsR.length) * 13;
      ensure(h + 2);
      rowsL.forEach((r, k) => doc.text(r, left + 6, state.y + k * 13));
      rowsR.forEach((r, k) => doc.text(r, left + wrapW / 2 + 6, state.y + k * 13));
      state.y += h + 2;
    }
  }

  return { doc, left, right, wrapW, pageW, write, options, ensure, state };
}

// --- question paper ---------------------------------------------------------

/** Student handout PDF — mirrors the SAVRA question-paper layout. No answers. */
export async function exportQuestionPaperPdf(
  content: QuestionPaperContent,
  title: string,
  meta: QuestionPaperMeta,
): Promise<void> {
  const { doc, left, wrapW, write, options, ensure, state } = await newDoc();

  write(title || "Question Paper", { size: 16, bold: true, align: "center", gap: 10 });

  const headerRows: [string, string][] = [
    ["SUBJECT", meta.subject ?? "—"],
    ["MAXIMUM MARKS", String(content.total_marks || "—")],
    ["CLASS", meta.grade ?? "—"],
    ["TIME", content.duration_min ? `${content.duration_min} min` : "—"],
    ["TOPIC", meta.topic ?? "—"],
  ];
  doc.setDrawColor(210);
  const boxTop = state.y - 4;
  for (const [k, v] of headerRows) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(k, left + 8, state.y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(v, left + 130, state.y);
    state.y += 16;
  }
  doc.rect(left, boxTop, wrapW, state.y - boxTop + 2);
  state.y += 16;

  if (content.general_instructions?.length) {
    write("General Instructions:", { size: 11, bold: true, gap: 5 });
    content.general_instructions.forEach((line, i) =>
      write(`${i + 1}. ${line}`, { size: 10, gap: 3, x: left + 12 }),
    );
    state.y += 12;
  }

  let qNo = 0;
  for (const s of content.sections ?? []) {
    state.y += 6;
    write(s.name, { size: 12, bold: true, align: "center", gap: 5 });
    if (s.instructions) write(s.instructions, { size: 9.5, italic: true, align: "center", gap: 8 });
    for (const q of s.questions) {
      qNo += 1;
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(`[${q.marks}]`, left + wrapW, state.y, { align: "right" });
      write(`${qNo}. ${q.text}`, { size: 10.5, gap: 4, maxWidth: wrapW - 24 });
      if (q.options?.length) options(q.options);
      state.y += 4;
    }
    state.y += 6;
  }

  doc.save(`${safeName(title)}.pdf`);
}

/** LLM-built marking key PDF. Separate download. */
export async function exportAnswerKeyPdf(
  key: AnswerKey,
  title: string,
  meta: QuestionPaperMeta,
): Promise<void> {
  const { doc, write, state } = await newDoc();

  write(`Answer Key — ${title || "Question Paper"}`, { size: 15, bold: true, align: "center", gap: 8 });
  const metaLine = [meta.subject, meta.grade, meta.teacher ? `Teacher: ${meta.teacher}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  if (metaLine) write(metaLine, { size: 9, align: "center", gap: 12 });

  for (const s of key.sections ?? []) {
    state.y += 6;
    write(s.name, { size: 12, bold: true, gap: 5 });
    for (const a of s.answers ?? []) {
      write(`${a.number}. ${a.answer}`, { size: 10.5, gap: 3, x: 60 });
      if (a.solution) write(a.solution, { size: 9.5, italic: true, gap: 4, x: 72 });
    }
    state.y += 6;
  }

  doc.save(`${safeName(title, "Answer Key")}.pdf`);
}

// --- .docx ----------------------------------------------------------------

async function docxBits() {
  return (import("docx" as string) as Promise<any>);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Student handout .docx. No answers. */
export async function exportQuestionPaperDocx(
  content: QuestionPaperContent,
  title: string,
  meta: QuestionPaperMeta,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopType } =
    await docxBits();

  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title || "Question Paper" })],
    }),
  ];

  const headerRows: [string, string][] = [
    ["Subject", meta.subject ?? "—"],
    ["Maximum Marks", String(content.total_marks || "—")],
    ["Class", meta.grade ?? "—"],
    ["Time", content.duration_min ? `${content.duration_min} min` : "—"],
    ["Topic", meta.topic ?? "—"],
  ];
  for (const [k, v] of headerRows) {
    body.push(
      new Paragraph({ children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: v })] }),
    );
  }
  body.push(new Paragraph({ text: "" }));

  if (content.general_instructions?.length) {
    body.push(new Paragraph({ children: [new TextRun({ text: "General Instructions:", bold: true })] }));
    content.general_instructions.forEach((line, i) =>
      body.push(new Paragraph({ text: `${i + 1}. ${line}` })),
    );
    body.push(new Paragraph({ text: "" }));
  }

  let qNo = 0;
  for (const s of content.sections ?? []) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: s.name, bold: true })],
      }),
    );
    if (s.instructions) {
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: s.instructions, italics: true, size: 20 })],
        }),
      );
    }
    for (const q of s.questions) {
      qNo += 1;
      body.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
          spacing: { before: 80 },
          children: [new TextRun({ text: `${qNo}. ${q.text}` }), new TextRun({ text: `\t[${q.marks}]` })],
        }),
      );
      (q.options ?? []).forEach((opt, i) =>
        body.push(new Paragraph({ indent: { left: 360 }, text: `(${LETTERS[i]}) ${opt}` })),
      );
    }
  }

  saveBlob(await Packer.toBlob(new Document({ sections: [{ children: body }] })), `${safeName(title)}.docx`);
}

/** LLM-built marking key .docx. Separate download. */
export async function exportAnswerKeyDocx(
  key: AnswerKey,
  title: string,
  meta: QuestionPaperMeta,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await docxBits();

  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Answer Key — ${title || "Question Paper"}` })],
    }),
  ];
  const metaLine = [meta.subject, meta.grade, meta.teacher ? `Teacher: ${meta.teacher}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  if (metaLine) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: metaLine, size: 18, color: "666666" })],
      }),
    );
  }

  for (const s of key.sections ?? []) {
    body.push(
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: s.name, bold: true })] }),
    );
    for (const a of s.answers ?? []) {
      body.push(
        new Paragraph({ children: [new TextRun({ text: `${a.number}. `, bold: true }), new TextRun({ text: a.answer })] }),
      );
      if (a.solution) {
        body.push(
          new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: a.solution, italics: true, size: 20 })] }),
        );
      }
    }
  }

  saveBlob(
    await Packer.toBlob(new Document({ sections: [{ children: body }] })),
    `${safeName(title, "Answer Key")}.docx`,
  );
}
