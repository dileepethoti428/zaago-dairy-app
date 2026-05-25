## Problem
The PDF is still rendering incorrectly because jsPDF is being used with a Telugu TTF font, but jsPDF does not reliably shape complex Telugu text. Telugu needs glyph shaping/reordering, so even with Noto Sans Telugu embedded, text can appear blank/garbled in iPhone PDF preview.

## Plan
1. Replace the current jsPDF text-based PDF generation path with a browser-print PDF path for reports.
2. Generate an HTML report using normal browser text rendering with CSS font fallback (`Noto Sans Telugu`, system Telugu fonts, sans-serif), so Telugu names render correctly.
3. Update the PDF preview/download/share flow to open/print/download the rendered report from the browser instead of relying on jsPDF’s unsupported Telugu shaping.
4. Keep the existing report layout and data columns, but ensure headers, farmer names, totals, and footers display correctly in Telugu/English.
5. Verify the generated report visually using a Telugu sample name before marking it complete.

## Technical details
- The current `src/lib/pdfUtils.ts` uses `jsPDF` + `jspdf-autotable`; this is the wrong rendering engine for Telugu.
- I will move PDF output to a Unicode-safe HTML print document/blob approach, because browsers correctly shape Telugu text.
- I will keep changes focused to the PDF utility/action flow and avoid touching unrelated farmer/payment logic.