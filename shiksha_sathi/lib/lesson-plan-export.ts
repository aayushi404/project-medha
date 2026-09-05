import type { LessonPlanContent } from "@/lib/generation-types";

type Meta = { teacher?: string; topic?: string; periods?: number };

const COLUMNS: { header: string; key: keyof LessonPlanContent["periods_detail"][number] }[] = [
  { header: "Period", key: "period_no" },
  { header: "Concept", key: "concept" },
  { header: "Learning Objective", key: "learning_objective" },
  { header: "Learning Outcomes", key: "learning_outcomes" },
  { header: "Teacher-Learning Process", key: "teacher_learning_process" },
  { header: "Assessment", key: "assessment" },
  { header: "Resources", key: "resources" },
];

function safeName(title: string): string {
  return (title || "lesson-plan").replace(/[^\p{L}\p{N}\- _]+/gu, "").trim().slice(0, 80) || "lesson-plan";
}

function metaLine(meta: Meta): string {
  return [
    meta.teacher ? `Teacher: ${meta.teacher}` : "",
    meta.topic ? `Topic: ${meta.topic}` : "",
    meta.periods ? `Periods: ${meta.periods}` : "",
  ]
    .filter(Boolean)
    .join("    ");
}

/** Client-side landscape PDF of the period table via jsPDF + autoTable. */
export async function exportLessonPlanPdf(
  content: LessonPlanContent,
  title: string,
  meta: Meta,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(15);
  doc.text(content.topic || title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(metaLine(meta), 40, 56);
  doc.setTextColor(20);

  autoTable(doc, {
    startY: 72,
    head: [COLUMNS.map((c) => c.header)],
    body: (content.periods_detail ?? []).map((p) =>
      COLUMNS.map((c) => String(p[c.key] ?? "")),
    ),
    styles: { fontSize: 8, cellPadding: 5, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [237, 233, 250], textColor: 40, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 34, halign: "center" } },
    margin: { left: 40, right: 40 },
  });

  if (content.homework) {
    const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    const y = (after?.finalY ?? 72) + 20;
    doc.setFontSize(9);
    doc.text(`Homework: ${content.homework}`, 40, y, { maxWidth: 760 });
  }

  doc.save(`${safeName(title)}.pdf`);
}

/** Client-side .docx of the period table via the `docx` library. */
export async function exportLessonPlanDocx(
  content: LessonPlanContent,
  title: string,
  meta: Meta,
): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    WidthType,
    TextRun,
  } = await import("docx");

  const cell = (text: string, bold = false) =>
    new TableCell({
      width: { size: 1, type: WidthType.AUTO },
      children: text
        .split("\n")
        .map((line) => new Paragraph({ children: [new TextRun({ text: line, bold, size: 16 })] })),
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: COLUMNS.map((c) => cell(c.header, true)) }),
      ...(content.periods_detail ?? []).map(
        (p) => new TableRow({ children: COLUMNS.map((c) => cell(String(p[c.key] ?? ""))) }),
      ),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: content.topic || title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: metaLine(meta), color: "666666", size: 18 })] }),
          new Paragraph({ text: "" }),
          table,
          ...(content.homework
            ? [
                new Paragraph({ text: "" }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Homework: ", bold: true }),
                    new TextRun({ text: content.homework }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(title)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
