import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getAppSetting, setAppSetting } from '@/db/database';

export type Language = 'en' | 'ur';

export const translations = {
  en: {
    // Navigation / Tabs
    tabHome: 'Home',
    tabRecords: 'Records',
    tabHerd: 'Herd',
    tabExpenses: 'Expenses',
    tabAccounts: 'Accounts',
    tabMilk: 'Milk',
    tabBuyers: 'Buyers',
    tabMore: 'More',
    moreTitle: 'More',
    moreSubtitle: 'Finances, data and settings',
    moreExpenses: 'Feed & Expenses',
    moreExpensesDesc: 'Feed purchases, wages, vet and other costs',
    moreReports: 'Weekly Reports',
    moreReportsDesc: 'Revenue, expenses and net earnings',
    moreBackup: 'Data & Backup',
    moreBackupDesc: 'Export, restore and keep records safe',
    moreProfile: 'Farm Profile & Rate',
    moreProfileDesc: 'Farm name, owner, default milk rate, PIN',
    moreLogout: 'Log Out',
    moreLogoutConfirm: 'Are you sure you want to log out?',
    cancel: 'Cancel',

    // Brand & Header
    appName: 'DairyFlow',
    defaultFarmName: 'DairyFlow',
    milkCollectionShifts: 'Milk Collection & Shifts',
    toggleLangBtn: 'اردو',
    languageIndicator: 'English',
    today: 'TODAY',
    pastRecord: 'PAST RECORD',

    // Dashboard Stats
    dailyProduction: 'Daily Milk Production',
    todayProduction: "Today's Production",
    morningShift: 'Morning Shift',
    eveningShift: 'Evening Shift',
    liters: 'Liters',
    litersUnit: 'L',
    avgFat: 'Average Fat',
    fat: 'Fat',
    rate: 'Rate',
    ratePerLiter: 'Rate / Liter',
    totalRevenue: 'Total Milk Sales',
    todayExpenses: "Today's Expenses",
    netSavings: 'Net Savings / Profit',
    quickActions: 'Quick Actions',
    addMilkBtn: '+ Add Milk Entry',
    addExpenseBtn: '+ Add Expense',
    addAnimalBtn: '+ Add Animal',
    recentMilkEntries: 'Recent Milk Entries',
    allEntries: 'All Entries',
    allShifts: 'All Shifts',
    morning: 'Morning',
    evening: 'Evening',
    noMilkRecordedToday: 'No milk entries recorded today.',
    startRecordingPrompt: 'Tap "+ Add Milk Entry" to log morning or evening milk collection.',

    // Milk Entry Modal
    milkEntryModalTitle: 'Record Milk Collection',
    editMilkEntryModalTitle: 'Edit Milk Collection',
    shiftLabel: 'Collection Shift',
    dateLabel: 'Collection Date',
    quantityLabel: 'Milk Quantity (Liters)',
    quantityPlaceholder: 'e.g. 85.5',
    fatPercentageLabel: 'Fat Percentage (%)',
    rateLabel: 'Rate per Liter (PKR)',
    ratePlaceholder: 'e.g. 210',
    buyerLabel: 'Buyer / Dairy Customer',
    selectBuyerPrompt: 'Choose buyer or customer',
    notesLabel: 'Notes (Optional)',
    notesPlaceholder: 'e.g. morning tank batch #1',
    totalCalculated: 'Total Amount',
    saveEntryBtn: 'Save Milk Entry',
    updateEntryBtn: 'Update Entry',
    cancelBtn: 'Cancel',

    // Livestock / Herd Screen
    herdScreenTitle: 'Livestock & Herd',
    totalAnimalsCount: 'Total Animals',
    activeInHerd: 'Active Animals in Herd',
    milkingToday: 'Milking Cows/Buffaloes',
    dryAnimals: 'Dry Animals',
    pregnantAnimals: 'Pregnant Animals',
    calvesHeifers: 'Calves & Kids',
    sickOrQuarantine: 'Sick / Under Treatment',
    logActivityBtn: 'Log Activity',
    recentActivity: 'Recent Health & Herd Activity',
    herdDirectory: 'Herd Directory',
    searchAnimalsPlaceholder: 'Search by tag, name, or breed...',
    addAnimalModalTitle: 'Add New Animal',
    tagNumberLabel: 'Tag Number',
    speciesLabel: 'Species',
    breedLabel: 'Breed',
    stageLabel: 'Current Stage',

    // Expenses Screen
    expensesScreenTitle: 'Farm Operating Expenses',
    totalPeriodExpenses: 'Total Farm Expenses',
    feedExpenses: 'Feed & Fodder',
    otherExpenses: 'Other Operational Expenses',
    addPurchaseOrExpenseBtn: '+ Add Purchase / Expense',
    categoryAll: 'All Categories',
    categoryFeed: 'Feed & Fodder',
    categoryLabour: 'Labour & Wages',
    categoryVeterinary: 'Veterinary & Medicine',
    categoryTransport: 'Transport & Fuel',
    categoryUtilities: 'Electricity & Water',
    categoryMaintenance: 'Maintenance & Repairs',
    categoryOther: 'General / Other',
    searchExpensesPlaceholder: 'Search expenses, payees or items...',
    operatingMargin: 'Est. Net Margin',

    // Buyers & Accounts Screen
    accountsScreenTitle: 'Buyer Accounts & Ledgers',
    buyersList: 'Registered Buyers',
    pendingReceivables: 'Total Pending Dues',
    recordPaymentBtn: 'Receive Payment',
    generateBillBtn: 'Generate Bill',
    callBuyer: 'Call',
    viewStatement: 'Statement',

    // Settings
    farmSettings: 'Farm Settings',
    farmNameLabel: 'Farm Name',
    defaultRateLabel: 'Standard Milk Rate (Rs/Liter)',

    // Sync & Cloud
    moreSync: 'Cloud Sync',
    moreSyncDesc: 'Multi-device sync, restore, and cloud backup',
    syncStatusOffline: 'Offline',
    syncStatusSyncing: 'Syncing…',
    syncStatusSynced: 'Synced',
    syncStatusPending: 'pending',
    cloudSyncTitle: 'Cloud Sync & Multi-Device',
    cloudSyncSubtitle: 'Automatic sync with MongoDB cloud',
    farmProfileHeading: 'Farm Cloud Account',
    ownerNameLabel: 'Owner Name',
    phoneLabel: 'Mobile Phone Number',
    passwordLabel: 'Password',
    defaultMilkRateLabel: 'Default Milk Rate (PKR/L)',
    signInBtn: 'Sign In',
    registerBtn: 'Register Farm',
    signOutBtn: 'Sign Out',
    syncNowBtn: 'Sync Now',
    lastSyncedLabel: 'Last Synced',
    neverSynced: 'Never synced',
    pendingChangesLabel: 'Pending Changes',
    noPendingChanges: 'All local changes are synced to cloud',
    pendingChangesNotice: 'changes waiting to be uploaded to cloud',
    signedInAs: 'Signed in as',
    switchToRegister: "Don't have an account? Register your farm",
    switchToSignIn: 'Already registered? Sign in',
    syncSuccess: 'Sync completed successfully',
    syncFailed: 'Sync failed. Please check internet connection.',
    offlineNotice: 'Device is offline. Changes are saved locally in SQLite.',
    invalidCredentials: 'Invalid phone number or password',
    phoneAlreadyExists: 'An account with this phone number already exists',
    confirmSignOut: 'Are you sure you want to sign out? Your local data will remain safe.',
    adminPinCloudNotice: 'Your Admin PIN is strictly device-local and is never sent to the cloud.',
    networkError: 'Could not connect to server. Check internet connection.',
    sessionExpired: 'Your cloud session has expired. Please sign in again.',

    // Common
    currencySymbol: 'Rs',
    offlineStatus: 'Offline Ready',
    syncedStatus: 'Synced',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
  },
  ur: {
    // Navigation / Tabs
    tabHome: 'ہوم',
    tabRecords: 'ریکارڈ',
    tabHerd: 'مال مویشی',
    tabExpenses: 'خرچے',
    tabAccounts: 'کھاتے',
    tabMilk: 'دودھ',
    tabBuyers: 'گاہک',
    tabMore: 'مزید',
    moreTitle: 'مزید',
    moreSubtitle: 'حساب کتاب، ڈیٹا اور سیٹنگز',
    moreExpenses: 'ونڈا تے خرچے',
    moreExpensesDesc: 'ونڈا، تنخواہاں، ڈاکٹر تے ہور خرچے',
    moreReports: 'ہفتہ وار رپورٹ',
    moreReportsDesc: 'آمدن، خرچے تے خالص بچت',
    moreBackup: 'ڈیٹا تے بیک اپ',
    moreBackupDesc: 'ریکارڈ محفوظ، ایکسپورٹ تے بحال کرو',
    moreProfile: 'فارم پروفائل تے ریٹ',
    moreProfileDesc: 'فارم دا ناں، مالک، ریٹ، پن',
    moreLogout: 'لاگ آؤٹ',
    moreLogoutConfirm: 'کیا تسیں لاگ آؤٹ ہونا چاہندے او؟',
    cancel: 'منسوخ',

    // Brand & Header
    appName: 'ڈیری فلو',
    defaultFarmName: 'ڈیری فلو',
    milkCollectionShifts: 'روزانہ دودھ دا ریکارڈ تے شفٹاں',
    toggleLangBtn: 'English',
    languageIndicator: 'اردو / پنجابی',
    today: 'اج دا دن',
    pastRecord: 'پچھلا ریکارڈ',

    // Dashboard Stats
    dailyProduction: 'روزانہ دودھ دی پیداوار',
    todayProduction: 'اج دی کل پیداوار',
    morningShift: 'صبح دی چوئی (سویر)',
    eveningShift: 'شام دی چوئی (سنجھ)',
    liters: 'لیٹر',
    litersUnit: 'لیٹر',
    avgFat: 'اوسط فیٹ (Fat)',
    fat: 'فیٹ (%)',
    rate: 'ریٹ',
    ratePerLiter: 'ریٹ فی لیٹر (روپے)',
    totalRevenue: 'کل دودھ دی فروخت',
    todayExpenses: 'اج دے کل خرچے',
    netSavings: 'اج دی بچت / منافع',
    quickActions: 'فوری کم',
    addMilkBtn: '+ دودھ دا اندراج',
    addExpenseBtn: '+ نواں خرچہ پاؤ',
    addAnimalBtn: '+ نواں جانور درج کرو',
    recentMilkEntries: 'اج دے دودھ دا اندراج',
    allEntries: 'سارے اندراج',
    allShifts: 'دونوں شفٹاں',
    morning: 'صبح',
    evening: 'شام',
    noMilkRecordedToday: 'اج دا کوئی دودھ درج نہیں ہویا۔',
    startRecordingPrompt: 'صبح یا شام دا دودھ درج کرن لئی "+ دودھ دا اندراج" دا بٹن دباؤ۔',

    // Milk Entry Modal
    milkEntryModalTitle: 'دودھ دا نواں اندراج',
    editMilkEntryModalTitle: 'دودھ دے اندراج دی درستی',
    shiftLabel: 'چوئی دی شفٹ',
    dateLabel: 'تاریخ',
    quantityLabel: 'دودھ دی مقدار (لیٹر)',
    quantityPlaceholder: 'مثلاً: 85.5',
    fatPercentageLabel: 'فیٹ فیصد (چکنائی %)',
    rateLabel: 'فی لیٹر ریٹ (روپے)',
    ratePlaceholder: 'مثلاً: 220',
    buyerLabel: 'گاہک / خریدار',
    selectBuyerPrompt: 'گاہک یا ڈیری چنو',
    notesLabel: 'نوٹ / تفصیل (اختیاری)',
    notesPlaceholder: 'کوئی خاص گل یا تفصیل...',
    totalCalculated: 'کل رقم (روپے)',
    saveEntryBtn: 'محفوظ کرو',
    updateEntryBtn: 'درست کرو',
    cancelBtn: 'منسوخ',

    // Livestock / Herd Screen
    herdScreenTitle: 'مال مویشی تے ڈنگر',
    totalAnimalsCount: 'کل ڈنگر (جانور)',
    activeInHerd: 'فارم تے موجود کل جانور',
    milkingToday: 'چوئی والیاں (دودھ دین والیاں)',
    dryAnimals: 'سُکیاں (کھلوتیاں)',
    pregnantAnimals: 'گابھن (امید نال)',
    calvesHeifers: 'وچھے، کٹیاں (چھوٹے بچے)',
    sickOrQuarantine: 'بیمار / زیرِ علاج ڈنگر',
    logActivityBtn: 'سرگرمی درج کرو',
    recentActivity: 'حالیہ علاج تے سرگرمیاں',
    herdDirectory: 'جانوراں دی فہرست',
    searchAnimalsPlaceholder: 'ٹیگ نمبر، ناں یا نسل نال تلاش کرو...',
    addAnimalModalTitle: 'نواں جانور درج کرو',
    tagNumberLabel: 'ٹیگ نمبر',
    speciesLabel: 'قسم (گائے / بھینس)',
    breedLabel: 'نسل (سایہیوال، نیلی وغیرہ)',
    stageLabel: 'موجودہ حالت',

    // Expenses Screen
    expensesScreenTitle: 'فارم دے خرچے تے ونڈا',
    totalPeriodExpenses: 'کل فارم خرچے',
    feedExpenses: 'ونڈا، پٹھے تے خوراک',
    otherExpenses: 'دیگر فارم خرچے',
    addPurchaseOrExpenseBtn: '+ نواں خرچہ یا ونڈا پاؤ',
    categoryAll: 'سارے خرچے',
    categoryFeed: 'ونڈا تے پٹھے',
    categoryLabour: 'مزدور تے ملازم',
    categoryVeterinary: 'ڈاکٹر تے دوائی',
    categoryTransport: 'گاڑی تے کرایہ',
    categoryUtilities: 'بجلی، پانی، گیس',
    categoryMaintenance: 'مرمت تے اوزار',
    categoryOther: 'متفرق خرچے',
    searchExpensesPlaceholder: 'خرچہ، دکاندار یا سامان تلاش کرو...',
    operatingMargin: 'تخمینہ منافع / بچت',

    // Buyers & Accounts Screen
    accountsScreenTitle: 'کھاتے تے بقایا جات',
    buyersList: 'رجسٹرڈ گاہک',
    pendingReceivables: 'کل بقایا رقم (ادھار)',
    recordPaymentBtn: 'رقم وصول کرو',
    generateBillBtn: 'ہفتہ وار بل بناؤ',
    callBuyer: 'کال کرو',
    viewStatement: 'کھاتہ دیکھو',

    // Settings
    farmSettings: 'فارم سیٹنگز',
    farmNameLabel: 'فارم دا ناں',
    defaultRateLabel: 'دودھ دا بنیادی ریٹ (روپے/لیٹر)',

    // Sync & Cloud
    moreSync: 'کلاؤڈ سنک',
    moreSyncDesc: 'ملٹی ڈیوائس سنک، ڈیٹا بحالی تے آن لائن بیک اپ',
    syncStatusOffline: 'آف لائن',
    syncStatusSyncing: 'سنک ہو رہا ہے…',
    syncStatusSynced: 'سنک مکمل',
    syncStatusPending: 'باقی',
    cloudSyncTitle: 'کلاؤڈ سنک تے ملٹی ڈیوائس',
    cloudSyncSubtitle: 'مونگو ڈی بی کلاؤڈ نال خودکار ہم آہنگی',
    farmProfileHeading: 'فارم کلاؤڈ اکاؤنٹ',
    ownerNameLabel: 'مالک دا ناں',
    phoneLabel: 'موبائل فون نمبر',
    passwordLabel: 'پاس ورڈ',
    defaultMilkRateLabel: 'دودھ دا بنیادی ریٹ (روپے/لیٹر)',
    signInBtn: 'لاگ ان کرو',
    registerBtn: 'فارم رجسٹر کرو',
    signOutBtn: 'لاگ آؤٹ کرو',
    syncNowBtn: 'ہن سنک کرو',
    lastSyncedLabel: 'آخری سنک',
    neverSynced: 'کدی سنک نہیں ہویا',
    pendingChangesLabel: 'باقی اندراجات',
    noPendingChanges: 'سارا ریکارڈ کلاؤڈ تے محفوظ تے سنک ہے',
    pendingChangesNotice: 'تبدیلیاں کلاؤڈ تے بھیجن لئی تیار نیں',
    signedInAs: 'لاگ ان اکاؤنٹ',
    switchToRegister: 'نواں فارم رجسٹر کرنا ہے؟ اتھے کلک کرو',
    switchToSignIn: 'پہلاں توں رجسٹرڈ او؟ لاگ ان کرو',
    syncSuccess: 'کلاؤڈ سنک کامیابی نال مکمل ہو گیا',
    syncFailed: 'سنک نہیں ہو سکیا۔ انٹرنیٹ کنکشن چیک کرو۔',
    offlineNotice: 'فون آف لائن ہے۔ ڈیٹا موبائل وچ محفوظ ہو رہا ہے۔',
    invalidCredentials: 'موبائل نمبر یا پاس ورڈ غلط ہے',
    phoneAlreadyExists: 'اس موبائل نمبر نال فارم پہلے توں موجود ہے',
    confirmSignOut: 'کیا تسیں سائن آؤٹ کرنا چاہندے او؟ تہاڈا لوکل ڈیٹا محفوظ رہے گا۔',
    adminPinCloudNotice: 'تہاڈا ایڈمن پن مکمل خفیہ ہے تے کدی وی کلاؤڈ تے نہیں جاندا۔',
    networkError: 'سرور نال رابطہ نہیں ہو سکیا۔ انٹرنیٹ چیک کرو۔',
    sessionExpired: 'تہاڈا سیشن ختم ہو گیا ہے۔ دوبارہ لاگ ان کرو۔',

    // Common
    currencySymbol: 'روپے',
    offlineStatus: 'آف لائن محفوظ',
    syncedStatus: 'آن لائن سنک',
    save: 'محفوظ کرو',
    edit: 'درستی',
    delete: 'ختم کرو',
    close: 'بند کرو',
  },
};

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isUrdu: boolean;
  t: (key: TranslationKey, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ur',
  setLanguage: () => {},
  toggleLanguage: () => {},
  isUrdu: true,
  t: (key: TranslationKey) => translations.ur[key] ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [language, setLanguageState] = useState<Language>('ur');

  // Load persisted language from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    getAppSetting(db, 'app_language', 'ur')
      .then((savedLang) => {
        if (isMounted && (savedLang === 'en' || savedLang === 'ur')) {
          setLanguageState(savedLang);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [db]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setAppSetting(db, 'app_language', lang).catch(() => {});
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === 'ur' ? 'en' : 'ur';
    setLanguage(nextLang);
  };

  const isUrdu = language === 'ur';

  const t = (key: TranslationKey, fallback?: string): string => {
    const activeDict = translations[language];
    return activeDict[key] ?? fallback ?? translations.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isUrdu,
        t,
      }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
