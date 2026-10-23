export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export type UserRole =
  | 'owner'
  | 'manager'
  | 'accountant'
  | 'staff'
  | 'collector'
  | 'farmer'
  | 'auditor';

export type BusinessType = 'farm' | 'collection_center' | 'hybrid';

export interface FarmProfile {
  id: string;
  farmName: string;
  ownerName: string;
  email?: string;
  phone?: string;
  defaultMilkRate?: number;
  businessType?: BusinessType;
  role?: UserRole;
  /** This person's own login id. The farm id above is the shared business. */
  userId?: string;
  /** This person's name, separate from the business owner's name. */
  accountName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SyncResult {
  status: 'success' | 'skipped' | 'error';
  appliedCount?: number;
  pulledCount?: number;
  /** Changes the server refused (validation). They are dropped from the queue, so surface them. */
  rejectedCount?: number;
  rejectedSample?: string;
  /** What kind of failure, so the UI can show a localized, non-technical message. */
  kind?: 'network' | 'server';
  message?: string;
}

export type SyncOp = 'upsert' | 'delete';

export interface ClientSyncChange {
  table: string;
  uuid: string;
  op: SyncOp;
  data?: Record<string, unknown>;
  clientUpdatedAt: string;
}

export interface ServerSyncChange {
  table: string;
  uuid: string;
  op: SyncOp;
  data?: Record<string, unknown>;
  seq: number;
}

export interface PushResponse {
  applied: number;
  rejected: {
    uuid: string;
    table: string;
    reason: string;
  }[];
  cursor: number;
}

export interface PullResponse {
  changes: ServerSyncChange[];
  cursor: number;
  hasMore: boolean;
}
