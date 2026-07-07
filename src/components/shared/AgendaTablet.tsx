// AgendaTablet — Philon's wax tablet (tabula cerata).
// Distinct from ScrollModal: dark wax surface inside a warm wooden frame.
// Auto-opened by App.tsx after each season resolves; also manually opened
// via AgendaBadge. Dispatches deep-link navigation when an item is tapped.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { generateAgenda } from '../../engine/agendaEngine';
import type { AgendaItem, AgendaSeverity } from '../../models/agenda';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const TABLET_MAX_ITEMS = 6;

const { width: SCREEN_W } = Dimensions.get('window');
const TABLET_W = Math.round(SCREEN_W * 0.88);

// ─── Severity colours (dot glyphs) ───────────────────────────────────────────

const SEVERITY_DOT_COLOR: Record<AgendaSeverity, string> = {
  critical:    COLORS.crimson,
  warning:     COLORS.amber,
  opportunity: COLORS.laurel,
  info:        COLORS.dust,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSeasonLabel(seasonIndex: number, year: number): string {
  const season = SEASON_NAMES[seasonIndex] ?? 'Spring';
  const absYear = Math.abs(year);
  return `${season}, ${absYear} BC — your secretary's notes`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: AgendaSeverity }) {
  return (
    <View style={[styles.dot, { backgroundColor: SEVERITY_DOT_COLOR[severity] }]} />
  );
}

function AgendaItemRow({
  item,
  onPress,
}: {
  item: AgendaItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={onPress} activeOpacity={0.7}>
      <SeverityDot severity={item.severity} />
      <View style={styles.itemText}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.itemDetail} numberOfLines={2}>{item.detail}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AgendaTablet() {
  const agendaVisible     = useGameStore(s => s.agendaVisible);
  const dismissAgenda     = useGameStore(s => s.dismissAgenda);
  const requestNavigation = useGameStore(s => s.requestNavigation);
  const seasonIndex       = useGameStore(s => s.seasonIndex);
  const year              = useGameStore(s => s.year);

  const [items, setItems]     = useState<AgendaItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Compute items once when the tablet opens; reset expansion state.
  // Items are not re-computed while open — no action can change state while
  // this modal is in front.
  useEffect(() => {
    if (agendaVisible) {
      setItems(generateAgenda(useGameStore.getState()));
      setExpanded(false);
    }
  }, [agendaVisible]);

  function handleItemPress(item: AgendaItem) {
    if (item.target) {
      requestNavigation(item.target);
    }
    dismissAgenda();
  }

  const displayed = expanded ? items : items.slice(0, TABLET_MAX_ITEMS);
  const overflow  = items.length - TABLET_MAX_ITEMS;

  if (!agendaVisible) return null;

  return (
    <Modal
      visible={agendaVisible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={dismissAgenda}
      />

      {/* Tablet frame + wax surface */}
      <View style={styles.positioner} pointerEvents="box-none">
        <View style={styles.tablet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>EX TABULIS PHILONIS</Text>
            <Text style={styles.headerSub}>
              {makeSeasonLabel(seasonIndex, year)}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Item list */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <Text style={styles.emptyText}>
                Nothing demands your attention, Domine. A rare season.
              </Text>
            ) : (
              <>
                {displayed.map(item => (
                  <AgendaItemRow
                    key={item.id}
                    item={item}
                    onPress={() => handleItemPress(item)}
                  />
                ))}

                {/* Expand affordance */}
                {!expanded && overflow > 0 && (
                  <TouchableOpacity
                    style={styles.moreRow}
                    onPress={() => setExpanded(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.moreText}>
                      …and {overflow} more {overflow === 1 ? 'matter' : 'matters'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.divider} />

          {/* Dismiss button */}
          <TouchableOpacity style={styles.dismissBtn} onPress={dismissAgenda}>
            <Text style={styles.dismissText}>Set aside</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  positioner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wooden frame → wax surface
  tablet: {
    width: TABLET_W,
    maxHeight: '80%',
    backgroundColor: COLORS.waxSurface,
    borderWidth: 8,
    borderColor: COLORS.waxFrame,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
    color: COLORS.waxInscription,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    textAlign: 'center',
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.waxFrame,
    marginVertical: SPACING.sm,
    opacity: 0.7,
  },

  // Scroll area
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: SPACING.xs,
  },

  // Individual agenda item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.waxFrame,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: FONTS.displayLight,
    fontSize: 13,
    color: COLORS.waxInscription,
    lineHeight: 18,
  },
  itemDetail: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    lineHeight: 15,
    marginTop: 2,
  },

  // Expand row
  moreRow: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  moreText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: COLORS.waxInscriptionDim,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    lineHeight: 20,
  },

  // Dismiss button
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dismissText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.waxInscriptionDim,
    textTransform: 'uppercase',
  },
});
