import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppCard } from '@/components/ui/card';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Expense } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

interface ExpenseCardProps {
  expense: Expense;
  onDelete?: (id: number) => void;
  onEdit?: (expense: Expense) => void;
  currencySymbol?: string;
}

function ExpenseCardBase({
  expense,
  onDelete,
  onEdit,
  currencySymbol = 'Rs',
}: ExpenseCardProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const isFeed = expense.category === 'Feed';

  // Format local calendar date (e.g. "Tue 13 Oct")
  const formattedDate = useMemo(() => {
    try {
      const [year, month, day] = expense.date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return expense.date;
    }
  }, [expense.date]);

  // Feed calculation string (e.g. "100 kg × Rs 40/kg")
  const feedCalculationText = useMemo(() => {
    if (!isFeed || !expense.quantity || !expense.unit_price) return null;
    const urduUnits: Record<string, string> = {
      kg: 'کلو',
      bags: 'بوری',
      bales: 'گٹھا',
      maund: 'من',
    };
    const rawUnit = expense.unit ? expense.unit : '';
    const unitLabel = rawUnit
      ? isUrdu
        ? urduUnits[rawUnit] ?? rawUnit
        : rawUnit
      : isUrdu
        ? 'یونٹ'
        : 'unit';
    return `${expense.quantity} ${unitLabel} × ${currencySymbol} ${expense.unit_price}/${unitLabel}`;
  }, [isFeed, isUrdu, expense.quantity, expense.unit_price, expense.unit, currencySymbol]);

  const paymentLabel = useMemo(() => {
    const pm = expense.payment_method ?? '';
    if (!isUrdu) return pm;
    if (pm === 'Bank Transfer') return 'بینک ٹرانسفر';
    if (pm === 'Credit / Due') return 'ادھار / واجب الادا';
    return pm;
  }, [expense.payment_method, isUrdu]);

  // Subtitle combining supplier/payee and date
  const subtitleText = useMemo(() => {
    const parts: string[] = [];
    if (expense.supplier_or_payee) {
      parts.push(expense.supplier_or_payee);
    }
    parts.push(formattedDate);
    if (!isFeed && expense.notes) {
      parts.push(expense.notes);
    }
    return parts.join(' · ');
  }, [expense.supplier_or_payee, formattedDate, isFeed, expense.notes]);

  // Category Icon & Color Theme
  const categoryIcon = useMemo(() => {
    switch (expense.category) {
      case 'Feed':
        return <MaterialCommunityIcons name="barley" size={18} color={theme.primary} />;
      case 'Labour':
        return <Ionicons name="people-outline" size={17} color={theme.success} />;
      case 'Veterinary':
        return <Ionicons name="medkit-outline" size={17} color={theme.info} />;
      case 'Transport':
        return <Ionicons name="car-outline" size={17} color={theme.morning} />;
      case 'Utilities':
        return <Ionicons name="flash-outline" size={17} color={theme.accent} />;
      case 'Maintenance':
        return <Ionicons name="build-outline" size={17} color={theme.textSecondary} />;
      case 'Other':
      default:
        return <Ionicons name="receipt-outline" size={17} color={theme.textSecondary} />;
    }
  }, [expense.category, theme]);

  const categoryBg = useMemo(() => {
    switch (expense.category) {
      case 'Feed':
        return theme.primaryLight;
      case 'Labour':
      case 'Veterinary':
        return theme.infoBg;
      case 'Transport':
        return theme.morningBg;
      case 'Utilities':
        return theme.accentBg;
      case 'Maintenance':
      case 'Other':
      default:
        return theme.backgroundElement;
    }
  }, [expense.category, theme]);

  const handleDeletePress = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(
      isUrdu ? 'خرچہ حذف کریں' : 'Delete Expense',
      isUrdu
        ? `کیا آپ واقعی "${expense.title}" (${currencySymbol} ${Math.round(expense.amount).toLocaleString()}) کو حذف کرنا چاہتے ہیں؟`
        : `Are you sure you want to delete "${expense.title}" (${currencySymbol} ${Math.round(expense.amount).toLocaleString()})?`,
      [
        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
        {
          text: isUrdu ? 'حذف کریں' : 'Delete',
          style: 'destructive',
          onPress: () => onDelete(expense.id),
        },
      ]
    );
  }, [currencySymbol, expense.amount, expense.id, expense.title, isUrdu, onDelete]);

  return (
    <AppCard variant="default" padding="md" style={styles.cardContainer}>
      <View style={styles.mainRow}>
        {/* Category Icon Bubble */}
        <View style={[styles.iconBubble, { backgroundColor: categoryBg }]}>
          {categoryIcon}
        </View>

        {/* Expense Info Column */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.titleText} numberOfLines={1}>
              {expense.title}
            </ThemedText>
          </View>

          {/* Subtitle / Vendor & Date */}
          <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitleText}
          </ThemedText>

          {/* Feed calculation (quantity × rate) when available */}
          {feedCalculationText ? (
            <View style={styles.feedCalcRow}>
              <ThemedText style={[styles.feedCalcText, { color: theme.primary }]}>
                {feedCalculationText}
              </ThemedText>
            </View>
          ) : null}

          {/* Feed notes if present */}
          {isFeed && expense.notes ? (
            <ThemedText style={[styles.feedNotesText, { color: theme.textMuted }]} numberOfLines={1}>
              {isUrdu ? 'نوٹ' : 'Note'}: {expense.notes}
            </ThemedText>
          ) : null}
        </View>

        {/* Right Amount & Actions Column */}
        <View style={styles.rightCol}>
          <ThemedText style={[styles.amountText, { color: theme.primary }]}>
            {currencySymbol} {Math.round(expense.amount).toLocaleString()}
          </ThemedText>

          {expense.payment_method && expense.payment_method !== 'Cash' ? (
            <View style={[styles.paymentBadge, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.paymentBadgeText, { color: theme.textSecondary }]}>
                {paymentLabel}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {onEdit ? (
              <Pressable
                onPress={() => onEdit(expense)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isUrdu ? `${expense.title} میں ترمیم کریں` : `Edit ${expense.title}`}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={15} color={theme.textSecondary} />
              </Pressable>
            ) : null}

            {onDelete ? (
              <Pressable
                onPress={handleDeletePress}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isUrdu ? `${expense.title} حذف کریں` : `Delete ${expense.title}`}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={15} color={theme.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: Spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  subtitleText: {
    fontSize: Typography.footnote.fontSize,
  },
  feedCalcRow: {
    marginTop: 2,
  },
  feedCalcText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});

export const ExpenseCard = memo(ExpenseCardBase);
