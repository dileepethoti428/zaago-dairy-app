import jsPDF from 'jspdf';
import { renderHtmlToPdf } from './pdfRenderer';
import {
  dailyCollectionHtml,
  farmerStatementHtml,
  settlementSummaryHtml,
  collectionReportHtml,
} from './htmlReports';

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
  paymentStatus: 'pending' | 'paid';
}

export interface SettlementFarmerSummary {
  farmerName: string;
  totalLitres: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid';
}

export interface SettlementSummaryData {
  centerName: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'locked' | 'paid';
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

export async function sharePDF(doc: jsPDF, filename: string): Promise<boolean> {
  try {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename.replace('.pdf', '') });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function previewPDF(doc: jsPDF) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
