/**
 * DairyFlow File Storage & Native Sharing Helpers
 * 
 * Implemented using Expo SDK 57 APIs:
 * - expo-file-system (File, Paths) for writing and reading files in the app cache directory
 * - expo-sharing for native share-sheet integration
 * - expo-document-picker for user document selection
 * 
 * Safety & Privacy:
 * - Writes only to the app's isolated cache sandbox directory (Paths.cache)
 * - Does NOT request broad or dangerous Android/iOS storage permissions
 * - Never silently overwrites user files
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export interface SavedFileResult {
  uri: string;
  filename: string;
}

export interface PickedDocumentResult {
  canceled: boolean;
  uri?: string;
  name?: string;
  size?: number;
}

/**
 * Sanitizes a filename to prevent path traversal or invalid filesystem characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Saves a string payload (CSV or JSON backup) into the application cache directory.
 * Overwrites existing temporary files with the exact same name if previously exported.
 * 
 * @param filename Desired name of the file (e.g. "dairyflow_backup_2026-10-14.json")
 * @param content Text or JSON content to save
 * @returns SavedFileResult containing the local file URI and filename
 */
export async function saveContentToCache(
  filename: string,
  content: string
): Promise<SavedFileResult> {
  const safeName = sanitizeFilename(filename);
  const file = new File(Paths.cache, safeName);

  // Create file in cache sandbox with overwrite enabled
  file.create({ overwrite: true });
  file.write(content);

  return {
    uri: file.uri,
    filename: safeName,
  };
}

/**
 * Reads text content from a local file URI (such as one returned by expo-document-picker).
 * Employs modern SDK 57 File reading with fetch() fallback for maximum platform compatibility.
 */
export async function readBackupFile(uri: string): Promise<string> {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid file URI: URI must be a non-empty string.');
  }

  try {
    const file = new File(uri);
    return await file.text();
  } catch (fileErr) {
    // Fallback: React Native supports fetch() on local file:// and content:// URIs
    try {
      const response = await fetch(uri);
      return await response.text();
    } catch {
      throw new Error(
        `Failed to read backup file at ${uri}: ${
          fileErr instanceof Error ? fileErr.message : String(fileErr)
        }`
      );
    }
  }
}

/**
 * Checks if the native sharing API is supported on the current device and platform.
 */
export async function isSharingAvailable(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Shares a local file using the device's native sharing sheet.
 * 
 * @param fileUri The local file URI to share
 * @param options Sharing options (dialogTitle, mimeType, etc.)
 */
export async function shareExportFile(
  fileUri: string,
  options?: {
    mimeType?: string;
    dialogTitle?: string;
    UTI?: string;
  }
): Promise<boolean> {
  const available = await isSharingAvailable();
  if (!available) {
    return false;
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: options?.mimeType,
    dialogTitle: options?.dialogTitle ?? 'Export DairyFlow Data',
    UTI: options?.UTI,
  });

  return true;
}

/**
 * Opens the native document picker for the user to select a DairyFlow backup file (.json).
 * Automatically copies the picked file to the app's internal cache directory so it can be read safely.
 */
export async function pickBackupDocument(): Promise<PickedDocumentResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { canceled: true };
  }

  const asset = result.assets[0];
  return {
    canceled: false,
    uri: asset.uri,
    name: asset.name,
    size: asset.size,
  };
}
