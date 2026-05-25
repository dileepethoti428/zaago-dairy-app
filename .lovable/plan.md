## Problem

PDF reports (Daily Collection, Farmer Statement, Settlement Summary, Collection Report) show Telugu farmer names as boxes/garbled text. This is because `jsPDF` uses the built-in `helvetica` font, which only supports Latin (WinAnsi) characters — it cannot render Telugu glyphs.

In your screenshot, "Eswaramma" renders only because it's English. A Telugu name like "ఈశ్వరమ్మ" would appear as empty boxes or missing glyphs.

## Fix: Embed a Telugu-capable Unicode font into jsPDF

Use **Noto Sans Telugu** (Google's free Unicode font with full Telugu + Latin coverage) and register it with jsPDF so it can render both English and Telugu in the same document.

### Steps

1. **Add font file**
   - Download `NotoSansTelugu-Regular.ttf` and `NotoSansTelugu-Bold.ttf` from Google Fonts.
   - Place them in `src/assets/fonts/`.
   - Convert to base64 (one-time, at build) and export as TS modules: `src/assets/fonts/NotoSansTelugu.ts` exporting `notoSansTeluguRegular` and `notoSansTeluguBold` base64 strings.

2. **Create a font registration helper**
   - New file: `src/lib/pdfFonts.ts`
   - Export `registerTeluguFont(doc: jsPDF)` that:
     - Calls `doc.addFileToVFS("NotoSansTelugu-Regular.ttf", notoSansTeluguRegular)`
     - Calls `doc.addFont("NotoSansTelugu-Regular.ttf", "NotoSansTelugu", "normal")`
     - Same for bold variant with style `"bold"`
     - Calls `doc.setFont("NotoSansTelugu")` to make it the default for the document.

3. **Update `src/lib/pdfUtils.ts`**
   - At the top of `generateDailyCollectionPDF`, `generateFarmerStatementPDF`, `generateSettlementSummaryPDF`, and `generateCollectionReportPDF`, call `registerTeluguFont(doc)` right after `const doc = new jsPDF()`.
   - Replace all `doc.setFont('helvetica', ...)` calls with `doc.setFont('NotoSansTelugu', ...)`.
   - In every `autoTable(...)` config, add:
     ```ts
     styles: { font: 'NotoSansTelugu', ... },
     headStyles: { font: 'NotoSansTelugu', ... },
     footStyles: { font: 'NotoSansTelugu', ... },
     ```
     so table cells (which contain farmer names) also use the Telugu-capable font.

### Why this works

- `addFileToVFS` + `addFont` registers the TTF inside the PDF.
- Noto Sans Telugu includes both Latin and Telugu glyphs, so English headers/numbers and Telugu names render correctly in the same document.
- Embedding adds ~300–400 KB per font weight to the bundle (lazy-loadable if needed later).

### Files changed

| File | Change |
|---|---|
| `src/assets/fonts/NotoSansTelugu-Regular.ttf` | New — font file |
| `src/assets/fonts/NotoSansTelugu-Bold.ttf` | New — font file |
| `src/assets/fonts/NotoSansTelugu.ts` | New — exports base64 font strings |
| `src/lib/pdfFonts.ts` | New — `registerTeluguFont(doc)` helper |
| `src/lib/pdfUtils.ts` | Register font + switch `setFont` and autoTable `font` to `NotoSansTelugu` in all 4 generators |

### Note on bundle size

Each font weight is ~300 KB as base64. If you'd prefer to keep it smaller, I can:
- Use only the Regular weight (skip Bold, simulate bold via styling) — saves ~300 KB, or
- Subset the font to only Telugu + basic Latin glyphs (~80 KB total) using `fonttools` — best size, slightly more setup.

Default plan uses full Regular + Bold for simplicity. Let me know if you'd like the subset approach instead.