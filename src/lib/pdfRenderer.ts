import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const FONT_LINK_ID = 'noto-telugu-font-link';

function ensureTeluguFontLoaded() {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans:wght@400;600;700&display=swap';
  document.head.appendChild(link);
}

/**
 * Render an HTML string to a jsPDF document.
 * The HTML is rendered by the browser (so complex scripts like Telugu shape
 * correctly), captured to a canvas, then split into A4 pages.
 */
export async function renderHtmlToPdf(html: string): Promise<jsPDF> {
  ensureTeluguFontLoaded();

  // A4 portrait at ~96dpi
  const pageWidthPx = 794;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = `${pageWidthPx}px`;
  container.style.background = '#ffffff';
  container.style.fontFamily =
    "'Noto Sans Telugu','Noto Sans','Helvetica','Arial',sans-serif";
  container.style.color = '#111';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Wait for webfonts to be ready so Telugu glyphs render correctly.
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    return pdf;
  } finally {
    document.body.removeChild(container);
  }
}
