import { useMemo } from 'react';

import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useSync } from '@/sync';
import type { ReportBrand, ReportLang } from '@/utils/pdf-report';

/** Farm identity and language for the header of generated PDF reports. */
export function useReportBrand(): { brand: ReportBrand; lang: ReportLang } {
  const { farmName, ownerName, ownerPhone } = useAdmin();
  const { farm } = useSync();
  const { isUrdu } = useLanguage();

  const brand = useMemo<ReportBrand>(
    () => ({
      farmName,
      ownerName,
      phone: ownerPhone || farm?.phone || undefined,
      email: farm?.email || undefined,
    }),
    [farmName, ownerName, ownerPhone, farm?.phone, farm?.email]
  );

  return { brand, lang: isUrdu ? 'ur' : 'en' };
}
