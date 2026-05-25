import type jsPDF from 'jspdf';
import { notoSansTeluguRegular } from '@/assets/fonts/NotoSansTelugu-Regular';
import { notoSansTeluguBold } from '@/assets/fonts/NotoSansTelugu-Bold';

export const TELUGU_FONT = 'NotoSansTelugu';

let registeredOnce = false;

/**
 * Register Noto Sans Telugu (regular + bold) into the given jsPDF document
 * and set it as the default font. Supports both Latin and Telugu glyphs.
 */
export function registerTeluguFont(doc: jsPDF) {
  doc.addFileToVFS('NotoSansTelugu-Regular.ttf', notoSansTeluguRegular);
  doc.addFont('NotoSansTelugu-Regular.ttf', TELUGU_FONT, 'normal');

  doc.addFileToVFS('NotoSansTelugu-Bold.ttf', notoSansTeluguBold);
  doc.addFont('NotoSansTelugu-Bold.ttf', TELUGU_FONT, 'bold');

  doc.setFont(TELUGU_FONT, 'normal');
  registeredOnce = true;
}
