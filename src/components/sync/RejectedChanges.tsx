import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppCard } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import {
  dismissSyncRejection,
  listOpenRejections,
  retrySyncRejection,
  type SyncRejectionRow,
} from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

export function RejectedChanges() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { syncNow } = useSync();
  const [rows, setRows] = useState<SyncRejectionRow[]>([]);

  const load = useCallback(async () => {
    setRows(await listOpenRejections(db));
  }, [db]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      listOpenRejections(db)
        .then((next) => {
          if (active) setRows(next);
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [db]);

  if (rows.length === 0) return null;

  return (
    <AppCard>
      <ThemedText style={{ fontWeight: '700', marginBottom: 6 }}>
        {isUrdu ? 'سنک نے یہ تبدیلیاں روکیں' : 'Sync held these changes'}
      </ThemedText>
      <ThemedText style={{ color: theme.textSecondary, marginBottom: 8 }}>
        {isUrdu
          ? 'یہ حذف نہیں ہوئیں۔ درست کر کے دوبارہ بھیجو۔ اگر دو فون ایک ہی ریکارڈ بدلیں تو بعد والی محفوظ ہوتی ہے۔'
          : 'They were not deleted. Fix them and try again. If two phones change the same record, the later save is kept.'}
      </ThemedText>
      {rows.map((row) => (
        <View key={row.id} style={{ marginBottom: 10 }}>
          <ThemedText style={{ fontWeight: '600' }}>
            {row.table_name} · {row.record_uuid.slice(0, 8)}
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>{row.reason}</ThemedText>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Pressable
              onPress={async () => {
                await retrySyncRejection(db, row.id);
                await syncNow();
                await load();
              }}>
              <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>{isUrdu ? 'دوبارہ' : 'Try again'}</ThemedText>
            </Pressable>
            <Pressable
              onPress={async () => {
                await dismissSyncRejection(db, row.id);
                await load();
              }}>
              <ThemedText style={{ color: theme.textSecondary }}>{isUrdu ? 'چھپائیں' : 'Dismiss'}</ThemedText>
            </Pressable>
          </View>
        </View>
      ))}
    </AppCard>
  );
}
