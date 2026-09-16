import type { QuizContent } from "@/lib/generation-types";

export type QuizMeta = {
  grade?: string;
  subject?: string;
  teacher?: string;
  chapter?: string;
  timeLimit?: number;
  level?: string;
};

function safeName(title: string): string {
  return (title || "quiz").replace(/[^\p{L}\p{N}\- _]+/gu, "").trim().slice(0, 80) || "quiz";
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function optionLines(q: QuizContent["questions"][number]): string[] {
  const opts = q.options?.length
    ? q.options
    : q.type === "truefalse"
      ? ["True", "False"]
      : [];
  return opts.map((o, i) => `(${LETTERS[i] ?? i + 1}) ${o}`);
}

/** Student handout PDF — mirrors the SAVRA quiz layout. No answers. */
export async function exportQuizPdf(
  content: QuizContent,
  title: string,
  meta: QuizMeta,
): Promise<void> {
  const { jsPDF } = await (import("jspdf" as string) as Promise<any>);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const wrapW = right - left;
  let y = 56;

  function ensure(space: number) {
    if (y + space > pageH - 48) {
      doc.addPage();
      y = 56;
    }
  }
  function line(text: string, opts: { size?: number; bold?: boolean; gap?: number; align?: "center" } = {}) {
    const { size = 11, bold = false, gap = 4, align } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const rows = doc.splitTextToSize(text, wrapW) as string[];
    for (const r of rows) {
      ensure(size + gap);
      if (align === "center") doc.text(r, pageW / 2, y, { align: "center" });
      else doc.text(r, left, y);
      y += size + gap;
    }
  }

  const questions = content.questions ?? [];
  line(title || meta.chapter || "Quiz", { size: 17, bold: true, align: "center", gap: 6 });
  if (meta.subject || meta.grade) {
    line([meta.subject, meta.grade].filter(Boolean).join(" - "), { size: 11, align: "center", gap: 10 });
  }

  const metaBits = [
    meta.timeLimit ? `Time: ${meta.timeLimit} mins` : "",
    `Total Marks: ${questions.length}`,
    `Questions: ${questions.length}`,
    meta.level ? `Level: ${meta.level}` : "",
  ].filter(Boolean);
  line(metaBits.join("     "), { size: 10, gap: 6 });
  if (meta.teacher) line(`Teacher: ${meta.teacher}`, { size: 10, gap: 4 });
  if (meta.chapter) line(`Chapters: ${meta.chapter}`, { size: 10, gap: 10 });

  doc.setDrawColor(210);
  ensure(16);
  doc.line(left, y, right, y);
  y += 16;

  questions.forEach((q, i) => {
    ensure(40);
    line(`Q${i + 1}. ${q.q}    [1 mark]`, { size: 11, bold: true, gap: 5 });
    for (const opt of optionLines(q)) line(opt, { size: 10.5, gap: 3 });
    y += 8;
  });

  doc.save(`${safeName(title)}.pdf`);
}

/** Student handout .docx. No answers. */
export async function exportQuizDocx(
  content: QuizContent,
  title: string,
  meta: QuizMeta,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = (await (import("docx" as string) as Promise<any>));
  const questions = content.questions ?? [];

  const metaBits = [
    meta.timeLimit ? `Time: ${meta.timeLimit} mins` : "",
    `Total Marks: ${questions.length}`,
    `Questions: ${questions.length}`,
    meta.level ? `Level: ${meta.level}` : "",
  ].filter(Boolean);

  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title || meta.chapter || "Quiz" })],
    }),
  ];
  if (meta.subject || meta.grade) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: [meta.subject, meta.grade].filter(Boolean).join(" - ") })],
      }),
    );
  }
  body.push(new Paragraph({ children: [new TextRun({ text: metaBits.join("     "), size: 20 })] }));
  if (meta.teacher) body.push(new Paragraph({ children: [new TextRun({ text: `Teacher: ${meta.teacher}`, size: 20 })] }));
  if (meta.chapter) body.push(new Paragraph({ children: [new TextRun({ text: `Chapters: ${meta.chapter}`, size: 20 })] }));
  body.push(new Paragraph({ text: "" }));

  questions.forEach((q, i) => {
    body.push(
      new Paragraph({
        children: [new TextRun({ text: `Q${i + 1}. ${q.q}`, bold: true }), new TextRun({ text: "   [1 mark]" })],
        spacing: { before: 120 },
      }),
    );
    for (const opt of optionLines(q)) body.push(new Paragraph({ text: opt }));
  });

  const blob = await Packer.toBlob(new Document({ sections: [{ children: body }] }));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(title)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
