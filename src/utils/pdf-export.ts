import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { sanitizeFilename } from '@/utils/file-storage';

// A4 at 72 PPI. Android WebView paginates to this size; iOS also applies the margins below.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

export interface PdfResult {
  uri: string;
  fileName: string;
  pages: number;
}

/**
 * Renders HTML to a PDF in the app cache with a meaningful file name
 * (expo-print yields a random one) and returns where it was saved.
 */
export async function renderPdf(html: string, fileName: string): Promise<PdfResult> {
  const { uri, numberOfPages } = await Print.printToFileAsync({
    html,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    margins: { top: 24, bottom: 24, left: 0, right: 0 },
  });

  const safeName = sanitizeFilename(fileName);
  try {
    const source = new File(uri);
    const target = new File(Paths.cache, safeName);
    await source.copy(target, { overwrite: true });
    return { uri: target.uri, fileName: safeName, pages: numberOfPages };
  } catch {
    // Renaming is cosmetic; the generated file itself is valid.
    return { uri, fileName: safeName, pages: numberOfPages };
  }
}

/** Opens the system share sheet (save to Files / Drive, WhatsApp, email…) for a PDF. */
export async function sharePdf(uri: string, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
  return true;
}

/** Convenience: build → save → share. Returns false when sharing is unavailable on the device. */
export async function exportPdf(html: string, fileName: string, dialogTitle: string): Promise<boolean> {
  const { uri } = await renderPdf(html, fileName);
  return sharePdf(uri, dialogTitle);
}
