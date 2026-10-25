import PptxGenJS from "pptxgenjs";
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
import * as XLSX from "xlsx";
import type { Asset, Generated, Suggestion } from "./types";

const hex = (c: string) => c.replace("#", "").toUpperCase();

/** Black or white, whichever reads better on the given background. */
export function onColor(bg: string): string {
  const n = parseInt(hex(bg), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#14213D" : "#FFFFFF";
}

export const colors = (s: Suggestion) => {
  const primary = s.brand.selected[0] ?? s.brand.palette[0] ?? "#0F766E";
  const secondary = s.brand.selected[1] ?? "#14213D";
  return { primary, secondary };
};

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileBase = (s: Suggestion) =>
  (s.title.trim() || "suggestion").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- Slides (.pptx) ---------- */
export async function exportSlides(s: Suggestion, g: Generated) {
  const { primary, secondary } = colors(s);
  const font = s.brand.font;
  const fs = s.brand.fontSize;
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

  const bullets = (items: string[]) =>
    items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } }));

  const content = (title: string, items: string[], numbered = false) => {
    const sl = p.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: hex(primary) } });
    sl.addText(title, { x: 0.9, y: 0.5, w: 11.5, h: 0.9, fontFace: font, fontSize: fs + 14, bold: true, color: hex(secondary) });
    sl.addText(
      items.map((t) => ({ text: t, options: { bullet: numbered ? { type: "number" as const } : true, breakLine: true } })),
      { x: 0.9, y: 1.7, w: 11.5, h: 5, valign: "top", fontFace: font, fontSize: fs + 4, color: "222222", paraSpaceAfter: 10 }
    );
  };

  const t = p.addSlide();
  t.background = { color: hex(primary) };
  t.addText(s.title || "Suggestion", { x: 0.9, y: 2.3, w: 11.5, h: 1.6, fontFace: font, fontSize: fs + 24, bold: true, color: hex(onColor(primary)) });
  t.addText(g.summary, { x: 0.9, y: 4.1, w: 11, h: 1.4, valign: "top", fontFace: font, fontSize: fs + 2, color: hex(onColor(primary)) });

  content("The problem", g.problemPoints);
  content("Proposed solution", g.solutionPoints);
  if (g.steps.length) content("How it works", g.steps, true);
  if (g.benefits.length) content("Expected benefits", g.benefits);

  s.assets.forEach((a: Asset, i) => {
    const sl = p.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addText(`Evidence ${i + 1}`, { x: 0.9, y: 0.4, w: 11, h: 0.7, fontFace: font, fontSize: fs + 10, bold: true, color: hex(secondary) });
    sl.addImage({ data: a.dataUrl.replace(/^data:/, ""), x: 1.9, y: 1.3, w: 9.5, h: 5.6, sizing: { type: "contain", w: 9.5, h: 5.6 } });
  });

  content("Next steps", g.nextSteps, true);
  await p.writeFile({ fileName: `${fileBase(s)}.pptx` });
}

/* ---------- Doc (.docx) ---------- */
function toBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const imageSize = (src: string) =>
  new Promise<{ w: number; h: number }>((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res({ w: 4, h: 3 });
    im.src = src;
  });

export async function exportDoc(s: Suggestion, g: Generated) {
  const { primary, secondary } = colors(s);
  const font = s.brand.font;
  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text, bold: true, color: hex(primary), font })],
    });
  const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 } });
  const body = (text: string) => new Paragraph({ text, spacing: { after: 120 } });

  const images: Paragraph[] = [];
  for (const a of s.assets) {
    const { w, h } = await imageSize(a.dataUrl);
    const width = 480;
    images.push(
      new Paragraph({ children: [new ImageRun({ data: toBytes(a.dataUrl), transformation: { width, height: Math.round((width * h) / w) } })] }),
      new Paragraph({ children: [new TextRun({ text: a.name, italics: true, color: "666666" })], spacing: { after: 200 } })
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font, size: s.brand.fontSize * 2 } } } },
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: s.title || "Suggestion", bold: true, size: (s.brand.fontSize + 14) * 2, color: hex(secondary), font })] }),
          body(g.summary),
          heading("The problem"), ...g.problemPoints.map(bullet),
          heading("Proposed solution"), ...g.solutionPoints.map(bullet),
          heading("How it works"), ...g.steps.map((t, i) => body(`${i + 1}. ${t}`)),
          ...(images.length ? [heading("Evidence"), ...images] : []),
          heading("Expected benefits"), ...g.benefits.map(bullet),
          heading("Next steps"), ...g.nextSteps.map(bullet),
        ],
      },
    ],
  });
  save(await Packer.toBlob(doc), `${fileBase(s)}.docx`);
}

/* ---------- Sheet (.xlsx) ---------- */
export function exportSheet(s: Suggestion, g: Generated) {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: (string | number)[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Summary", [
    ["Field", "Value"],
    ["Title", s.title], ["Summary", g.summary], ["Problem", s.problem], ["Proposed solution", s.solution],
  ], [20, 90]);
  add("Action plan", [
    ["Step", "Description", "Owner", "Due date", "Status"],
    ...g.steps.map((t, i) => [i + 1, t, "", "", "Not started"]),
  ], [8, 70, 18, 14, 14]);
  add("Impact", [
    ["Benefit / metric", "Baseline", "Target", "How measured"],
    ...g.benefits.map((b) => [b, "", "", ""]),
  ], [60, 14, 14, 30]);
  XLSX.writeFile(wb, `${fileBase(s)}.xlsx`);
}
