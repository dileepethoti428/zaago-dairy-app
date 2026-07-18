import jsPDF from "jspdf";
import { renderHtmlToPdf } from "./pdfRenderer";
import { dailyCollectionHtml, farmerStatementHtml, settlementSummaryHtml, collectionReportHtml } from "./htmlReports";

// ----- Types (kept for callers) -----

export interface PDFHeader {
  appName: string;
  collectionCenter: string;
  reportType: string;
}

export interface DailyCollectionEntry {
  farmerName: string;
  farmerId: string;
  quantity: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}

export interface DailyCollectionData {
  date: string;
  centerName: string;
  totalMilk: number;
  totalFarmers: number;
  entries: DailyCollectionEntry[];
}

export interface FarmerStatementEntry {
  date: string;
  quantity: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}

export interface FarmerStatementData {
  farmerName: string;
  farmerId: string;
  village: string;
  startDate: string;
  endDate: string;
  entries: FarmerStatementEntry[];
  totalLitres: number;
  totalAmount: number;
  paymentStatus: "pending" | "paid";
}

export interface SettlementFarmerSummary {
  farmerName: string;
  totalLitres: number;
  totalAmount: number;
  paymentStatus: "pending" | "paid";
}

export interface SettlementSummaryData {
  centerName: string;
  startDate: string;
  endDate: string;
  status: "open" | "locked" | "paid";
  totalMilk: number;
  totalAmount: number;
  farmers: SettlementFarmerSummary[];
}

export interface CollectionReportPDFData {
  centerName: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  totalLitres: number;
  totalAmount: number;
  totalFarmers: number;
  totalEntries: number;
  avgFat: number;
  avgSnf: number;
  avgRate: number;
  farmers: {
    farmerName: string;
    farmerId: string;
    totalLitres: number;
    totalAmount: number;
    entriesCount: number;
  }[];
}

// ----- PDF generators (HTML → PDF, Telugu-safe) -----

export function generateDailyCollectionPDF(data: DailyCollectionData): Promise<jsPDF> {
  return renderHtmlToPdf(dailyCollectionHtml(data));
}

export function generateFarmerStatementPDF(data: FarmerStatementData): Promise<jsPDF> {
  return renderHtmlToPdf(farmerStatementHtml(data));
}

export function generateSettlementSummaryPDF(data: SettlementSummaryData): Promise<jsPDF> {
  return renderHtmlToPdf(settlementSummaryHtml(data));
}

export function generateCollectionReportPDF(data: CollectionReportPDFData): Promise<jsPDF> {
  return renderHtmlToPdf(collectionReportHtml(data));
}

// ----- Output helpers -----

/**
 * Convert a Blob to a Base64 string without the data URL prefix.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Failed to convert PDF to Base64"));
        return;
      }

      const base64 = result.split(",")[1];

      if (!base64) {
        reject(new Error("Invalid Base64 PDF data"));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read PDF"));
    };

    reader.readAsDataURL(blob);
  });
}

/**
 * Detect whether the website is running inside the Zaago Android app.
 */
function isZaagoAndroidApp(): boolean {
  return Boolean((window as any).ZaagoAndroid);
}

/**
 * Share PDF
 */
export async function sharePDF(doc: jsPDF, filename: string): Promise<boolean> {
  try {
    const blob = doc.output("blob");

    // Android native app
    if (isZaagoAndroidApp()) {
      const base64 = await blobToBase64(blob);

      (window as any).ZaagoAndroid.sharePDF(base64, filename);

      return true;
    }

    // Normal browser
    const file = new File([blob], filename, { type: "application/pdf" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename.replace(".pdf", ""),
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Share failed:", error);
    return false;
  }
}

/**
 * Download PDF
 */
export async function downloadPDF(doc: jsPDF, filename: string): Promise<void> {
  try {
    const blob = doc.output("blob");

    // Android native app
    if (isZaagoAndroidApp()) {
      const base64 = await blobToBase64(blob);

      (window as any).ZaagoAndroid.downloadPDF(base64, filename);

      return;
    }

    // Normal browser
    doc.save(filename);
  } catch (error) {
    console.error("PDF download failed:", error);
  }
}

/**
 * Preview PDF
 */
export async function previewPDF(doc: jsPDF, filename: string = "Zaago-Report.pdf"): Promise<void> {
  try {
    const blob = doc.output("blob");

    // Android native app
    if (isZaagoAndroidApp()) {
      const base64 = await blobToBase64(blob);

      (window as any).ZaagoAndroid.previewPDF(base64, filename);

      return;
    }

    // Normal browser
    const url = URL.createObjectURL(blob);

    window.open(url, "_blank");

    // Release URL later
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  } catch (error) {
    console.error("PDF preview failed:", error);
  }
}
