import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddAnimalModal } from '@/components/dairy/AddAnimalModal';
import { HerdAlertBanner } from '@/components/dairy/HerdAlertBanner';
import { HerdCategoryGrid } from '@/components/dairy/HerdCategoryCard';
import { HerdSummaryCard } from '@/components/dairy/HerdSummaryCard';
import { LivestockActivityCard } from '@/components/dairy/LivestockActivityCard';
import { LogActivityModal } from '@/components/dairy/LogActivityModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
  LanguageToggleButton,
} from '@/components/ui';
import { BorderRadius, Layout, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  AnimalSpecies,
  deleteLivestockAnimal,
  getAllLivestock,
  getLivestockSummary,
  getRecentActivities,
  insertLivestockActivity,
  insertLivestockAnimal,
  LivestockActivity,
  LivestockAnimal,
  LivestockSummary,
  NewLivestockActivity,
  NewLivestockAnimal,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

const EMPTY_SUMMARY: LivestockSummary = {
  totalAnimals: 0,
  lactatingCount: 0,
  cowsCount: 0,
  cowsLactating: 0,
  buffaloesCount: 0,
  buffaloesLactating: 0,
  calvesCount: 0,
  calvesFemale: 0,
  calvesMale: 0,
};

// ---------------------------------------------------------------------------
// Animal row (memoized)
// ---------------------------------------------------------------------------
interface AnimalRowProps {
  animal: LivestockAnimal;
  farmBredLabel: string;
  removeLabel: string;
  onDelete: (animal: LivestockAnimal) => void;
}

const AnimalRow = memo(function AnimalRow({
  animal,
  farmBredLabel,
  removeLabel,
  onDelete,
}: AnimalRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.animalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.tagBadge, { backgroundColor: theme.primaryLight }]}>
        <ThemedText style={[styles.tagText, { color: theme.primaryDark }]} numberOfLines={1}>
          {animal.tag_number}
        </ThemedText>
      </View>
      <View style={styles.animalMeta}>
        <ThemedText style={styles.animalName} numberOfLines={1}>
          {animal.name || `${animal.species} (${animal.breed || farmBredLabel})`}
        </ThemedText>
        <ThemedText style={[styles.animalSubtext, { color: theme.textSecondary }]} numberOfLines={1}>
          {animal.species} · {animal.gender} · {animal.status}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => onDelete(animal)}
        accessibilityRole="button"
        accessibilityLabel={`${removeLabel} ${animal.tag_number}`}
        hitSlop={4}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
        <AppIcon name="close" size={18} color={theme.textMuted} />
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function LivestockScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const [summary, setSummary] = useState<LivestockSummary>(EMPTY_SUMMARY);
  const [activities, setActivities] = useState<LivestockActivity[]>([]);
  const [animals, setAnimals] = useState<LivestockAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<AnimalSpecies | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddAnimalOpen, setIsAddAnimalOpen] = useState(false);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setFeedbackToast(msg);
    toastTimer.current = setTimeout(() => setFeedbackToast(null), 3000);
  }, []);

  const loadLivestockData = useCallback(async () => {
    try {
      const [sum, acts, anims] = await Promise.all([
        getLivestockSummary(db),
        getRecentActivities(db, 20),
        getAllLivestock(db),
      ]);
      setSummary(sum);
      setActivities(acts);
      setAnimals(anims);
    } catch (err) {
      console.error('Failed to load livestock data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  // Fires on mount and whenever the Herd tab regains focus.
  useFocusEffect(
    useCallback(() => {
      loadLivestockData();
    }, [loadLivestockData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLivestockData();
  }, [loadLivestockData]);

  const handleSaveAnimal = useCallback(
    async (newAnimal: NewLivestockAnimal) => {
      await insertLivestockAnimal(db, newAnimal);
      showToast(
        isUrdu ? `جانور ${newAnimal.tag_number} درج ہو گیا` : `Registered animal ${newAnimal.tag_number}.`
      );
      loadLivestockData();
    },
    [db, isUrdu, loadLivestockData, showToast]
  );

  const handleSaveActivity = useCallback(
    async (newActivity: NewLivestockActivity) => {
      await insertLivestockActivity(db, newActivity);
      showToast(
        isUrdu ? `سرگرمی "${newActivity.title}" درج ہو گئی` : `Recorded activity "${newActivity.title}".`
      );
      loadLivestockData();
    },
    [db, isUrdu, loadLivestockData, showToast]
  );

  const handleDeleteAnimal = useCallback(
    (animal: LivestockAnimal) => {
      Alert.alert(
        isUrdu ? 'جانور ہٹاؤ' : 'Remove animal',
        isUrdu
          ? `کی تسیں جانور ${animal.tag_number} (${animal.species}) نوں ریوڑ وچوں ہٹانا چاہندے او؟`
          : `Are you sure you want to remove animal ${animal.tag_number} (${animal.species}) from the herd?`,
        [
          { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
          {
            text: isUrdu ? 'ہٹاؤ' : 'Remove',
            style: 'destructive',
            onPress: async () => {
              await deleteLivestockAnimal(db, animal.id);
              showToast(isUrdu ? `جانور ${animal.tag_number} ہٹا دتا گیا` : `Removed animal ${animal.tag_number}.`);
              loadLivestockData();
            },
          },
        ]
      );
    },
    [db, isUrdu, loadLivestockData, showToast]
  );

  const filteredAnimals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return animals.filter((a) => {
      if (selectedCategory !== 'All' && a.species !== selectedCategory) return false;
      if (!q) return true;
      return (
        a.tag_number.toLowerCase().includes(q) ||
        (a.name ? a.name.toLowerCase().includes(q) : false) ||
        (a.breed ? a.breed.toLowerCase().includes(q) : false) ||
        a.status.toLowerCase().includes(q)
      );
    });
  }, [animals, selectedCategory, searchQuery]);

  const scheduledAlert = useMemo(
    () =>
      activities.find((a) => a.activity_type === 'Deworming' || a.activity_type === 'Vaccination') ??
      activities[0] ??
      null,
    [activities]
  );

  const handleAlertPress = useCallback(() => {
    if (!scheduledAlert) return;
    const tag = scheduledAlert.animal_tag.toLowerCase();
    if (tag.includes('calf') || tag.includes('k-')) setSelectedCategory('Calf');
    else if (tag.includes('cow') || tag.includes('c-')) setSelectedCategory('Cow');
    else if (tag.includes('buffalo') || tag.includes('b-')) setSelectedCategory('Buffalo');
  }, [scheduledAlert]);

  const openAddAnimal = useCallback(() => setIsAddAnimalOpen(true), []);
  const closeAddAnimal = useCallback(() => setIsAddAnimalOpen(false), []);
  const openLogActivity = useCallback(() => setIsLogActivityOpen(true), []);
  const closeLogActivity = useCallback(() => setIsLogActivityOpen(false), []);
  const clearCategory = useCallback(() => setSelectedCategory('All'), []);

  const farmBredLabel = isUrdu ? 'دیسی فارم' : 'Farm bred';
  const removeLabel = isUrdu ? 'ہٹاؤ' : 'Remove';

  const renderItem = useCallback(
    ({ item }: { item: LivestockAnimal }) => (
      <AnimalRow
        animal={item}
        farmBredLabel={farmBredLabel}
        removeLabel={removeLabel}
        onDelete={handleDeleteAnimal}
      />
    ),
    [farmBredLabel, handleDeleteAnimal, removeLabel]
  );

  const keyExtractor = useCallback((item: LivestockAnimal) => String(item.id), []);

  const recentActivities = activities.slice(0, 3);

  const header = (
    <View style={styles.headerContainer}>
      {/* Brand row */}
      <View style={styles.brandRow}>
        <View style={styles.brandIdentity}>
          <IconBubble icon="cow" variant="mint" size={42} iconSize={22} />
          <View style={styles.flexShrink}>
            <ThemedText style={styles.brandTitle}>{isUrdu ? 'مال مویشی (ڈنگر)' : 'Livestock'}</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
              {isUrdu ? 'فارم دے جانوراں دی دیکھ بھال' : 'A healthy herd, at a glance'}
            </ThemedText>
          </View>
        </View>
        <LanguageToggleButton />
      </View>

      <HerdSummaryCard summary={summary} />

      {/* Primary actions */}
      <View style={styles.actionsRow}>
        <AppButton
          variant="primary"
          size="lg"
          title={isUrdu ? 'نواں جانور' : 'Add animal'}
          icon={<AppIcon name="add" size={20} color="#FFFFFF" />}
          onPress={openAddAnimal}
          style={styles.flex}
        />
        <AppButton
          variant="secondary"
          size="lg"
          title={isUrdu ? 'سرگرمی لاگ' : 'Log activity'}
          icon={<AppIcon name="calendar" size={18} color={theme.text} />}
          onPress={openLogActivity}
          style={styles.flex}
        />
      </View>

      <HerdCategoryGrid
        summary={summary}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {scheduledAlert ? (
        <HerdAlertBanner
          title={scheduledAlert.title}
          subtitle={`${scheduledAlert.animal_tag}${scheduledAlert.notes ? ` · ${scheduledAlert.notes}` : ''}`}
          onPress={handleAlertPress}
        />
      ) : null}

      {/* Recent activity */}
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>{isUrdu ? 'حالیہ سرگرمیاں' : 'Recent activity'}</ThemedText>
      </View>
      <AppCard variant="default" padding="none" style={styles.activitiesCard}>
        {recentActivities.length > 0 ? (
          recentActivities.map((act, index) => (
            <LivestockActivityCard
              key={act.id}
              activity={act}
              isLast={index === recentActivities.length - 1}
            />
          ))
        ) : (
          <View style={styles.emptyActivity}>
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              {isUrdu ? 'اجے کوئی سرگرمی درج نہیں ہوئی' : 'No health or herd activities logged yet.'}
            </ThemedText>
          </View>
        )}
      </AppCard>

      {/* Directory */}
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>
          {isUrdu
            ? `جانوراں دی لسٹ (${filteredAnimals.length})`
            : `Herd directory (${filteredAnimals.length})`}
        </ThemedText>
        {selectedCategory !== 'All' ? (
          <Pressable onPress={clearCategory} hitSlop={10} accessibilityRole="button">
            <ThemedText style={[styles.linkText, { color: theme.primary }]}>
              {isUrdu ? 'فلٹر صاف کرو' : 'Clear filter'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <AppTextInput
        placeholder={
          isUrdu ? 'ٹیگ نمبر، ناں، یا نسل نال تلاش کرو...' : 'Search by tag, name, breed, or status...'
        }
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<AppIcon name="search" size={18} color={theme.textMuted} />}
      />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {feedbackToast ? (
        <View style={[styles.toastContainer, { backgroundColor: theme.primaryDark }]}>
          <AppIcon name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{feedbackToast}</ThemedText>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredAnimals}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyActivity}>
              <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                {isUrdu ? 'کوئی جانور نہیں ملیا' : 'No animals found.'}
              </ThemedText>
            </View>
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        />
      )}

      <AddAnimalModal visible={isAddAnimalOpen} onClose={closeAddAnimal} onSave={handleSaveAnimal} />
      <LogActivityModal visible={isLogActivityOpen} onClose={closeLogActivity} onSave={handleSaveActivity} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  toastText: { color: '#FFFFFF', fontSize: Typography.subhead.fontSize, fontWeight: '600', flexShrink: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  headerContainer: { gap: Spacing.md, marginBottom: Spacing.sm },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  brandTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700', letterSpacing: -0.2 },
  brandSubtitle: { fontSize: Typography.footnote.fontSize, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  linkText: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  activitiesCard: { paddingHorizontal: Spacing.md },
  emptyActivity: { paddingVertical: Spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: Typography.footnote.fontSize },
  animalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.xs, maxWidth: 90 },
  tagText: { fontSize: Typography.caption.fontSize, fontWeight: '700' },
  animalMeta: { flex: 1, gap: 2 },
  animalName: { fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  animalSubtext: { fontSize: Typography.caption.fontSize },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
