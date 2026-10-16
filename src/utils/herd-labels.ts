/**
 * Display labels for herd values. The database stores the English identifiers
 * ('Cow', 'Lactating', 'Group Move', …); only what the user reads is translated.
 * Pure module (no React Native imports) so it can be unit-tested with plain Node.
 */

export type HerdLang = 'en' | 'ur';

type Dict = Record<string, { en: string; ur: string }>;

const SPECIES: Dict = {
  Cow: { en: 'Cow', ur: 'گائے' },
  Buffalo: { en: 'Buffalo', ur: 'بھینس' },
  Calf: { en: 'Calf', ur: 'بچھڑا / بچھڑی' },
};

const GENDER: Dict = {
  Female: { en: 'Female', ur: 'مادہ' },
  Male: { en: 'Male', ur: 'نر' },
};

const STATUS: Dict = {
  Lactating: { en: 'Lactating', ur: 'دودھ دینے والی' },
  Dry: { en: 'Dry', ur: 'خشک' },
  Pregnant: { en: 'Pregnant', ur: 'گابھن' },
  Heifer: { en: 'Heifer', ur: 'بچھیا' },
  Bull: { en: 'Bull', ur: 'سانڈ' },
  Calf: { en: 'Calf', ur: 'بچھڑا' },
};

const ACTIVITY: Dict = {
  Vaccination: { en: 'Vaccination', ur: 'ٹیکہ کاری' },
  Deworming: { en: 'Deworming', ur: 'کیڑے مار دوا' },
  Calving: { en: 'Calving', ur: 'بچھڑا پیدا ہونا' },
  Insemination: { en: 'Insemination', ur: 'مصنوعی تخم ریزی' },
  Treatment: { en: 'Treatment', ur: 'علاج' },
  'Group Move': { en: 'Group Move', ur: 'گروپ تبدیلی' },
  Other: { en: 'Other', ur: 'دیگر' },
};

const ACTIVITY_DEFAULT_TITLE: Dict = {
  Vaccination: { en: 'Vaccination completed', ur: 'ٹیکہ کاری مکمل' },
  Deworming: { en: 'Deworming completed', ur: 'کیڑے مار دوا مکمل' },
  Calving: { en: 'New calf registered', ur: 'نیا بچھڑا درج' },
  Insemination: { en: 'Artificial insemination', ur: 'مصنوعی تخم ریزی' },
  Treatment: { en: 'Medical treatment', ur: 'طبی علاج' },
  'Group Move': { en: 'Moved to lactating group', ur: 'دودھ دینے والے گروپ وچ منتقل' },
  Other: { en: 'Herd health check', ur: 'ریوڑ دا صحت معائنہ' },
};

const pick = (dict: Dict, key: string, lang: HerdLang): string => dict[key]?.[lang] ?? key;

export const speciesLabel = (species: string, lang: HerdLang) => pick(SPECIES, species, lang);
export const genderLabel = (gender: string, lang: HerdLang) => pick(GENDER, gender, lang);
export const statusLabel = (status: string, lang: HerdLang) => pick(STATUS, status, lang);
export const activityTypeLabel = (type: string, lang: HerdLang) => pick(ACTIVITY, type, lang);

/** Suggested title when an activity type is picked, in the user's language. */
export const defaultActivityTitle = (type: string, lang: HerdLang) =>
  pick(ACTIVITY_DEFAULT_TITLE, type, lang);

/** All known default titles (every language), to tell a suggested title from one the user typed. */
export function isDefaultActivityTitle(title: string): boolean {
  return Object.values(ACTIVITY_DEFAULT_TITLE).some((t) => t.en === title || t.ur === title);
}
