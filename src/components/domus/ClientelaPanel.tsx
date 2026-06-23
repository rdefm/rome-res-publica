import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { ClientType, Client } from '../../models/client';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Asset map ───────────────────────────────────────────────────────────────
// Assets drop in without code changes once files exist in src/assets/images/.
// The View fallback renders until then.

const PORTRAIT_ASSETS: Record<ClientType, ReturnType<typeof require> | null> = {
  muscle: (() => {
    try { return require('../../assets/images/portrait-client-muscle.png'); } catch { return null; }
  })(),
  publicSupport: (() => {
    try { return require('../../assets/images/portrait-client-support.png'); } catch { return null; }
  })(),
  votingSway: (() => {
    try { return require('../../assets/images/portrait-client-votes.png'); } catch { return null; }
  })(),
};

// ─── Type configuration ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ClientType, {
  emoji: string;
  label: string;
  borderColor: string;
  bonusText: string;
}> = {
  muscle: {
    emoji: '🛡️',
    label: 'MUSCLE',
    borderColor: COLORS.crimson,
    bonusText: 'Unlocks coercive options in certain events.',
  },
  publicSupport: {
    emoji: '📣',
    label: 'PUBLIC SUPPORT',
    borderColor: COLORS.laurel,
    bonusText: '+5% Gratia income per client per season.',
  },
  votingSway: {
    emoji: '🗳️',
    label: 'VOTING SWAY',
    borderColor: COLORS.gold,
    bonusText: '+1 vote per client during elections.',
  },
};

const CLIENT_TYPE_ORDER: ClientType[] = ['muscle', 'publicSupport', 'votingSway'];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ClientPortraitProps {
  client: Client;
  borderColor: string;
  type: ClientType;
}

function ClientPortrait({ client, borderColor, type }: ClientPortraitProps) {
  const asset = PORTRAIT_ASSETS[type];

  return (
    <View style={styles.clientCard}>
      {asset ? (
        <Image
          source={asset}
          style={[styles.portrait, { borderColor }]}
          defaultSource={asset}
        />
      ) : (
        <View style={[styles.portrait, styles.portraitFallback, { borderColor }]} />
      )}
      <Text style={styles.clientName} numberOfLines={1} ellipsizeMode="tail">
        {client.name}
      </Text>
    </View>
  );
}

interface TrackerRowProps {
  type: ClientType;
  clients: Client[];
}

function TrackerRow({ type, clients }: TrackerRowProps) {
  const config = TYPE_CONFIG[type];
  const typeClients = clients.filter(c => c.type === type);
  const count = typeClients.length;

  return (
    <View style={styles.trackerRow}>
      {/* Row header */}
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>
          {config.emoji} {config.label}
        </Text>
        <Text style={styles.rowCount}>[{count}]</Text>
      </View>

      {/* Horizontal client scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clientScrollContent}
      >
        {count === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>None yet</Text>
          </View>
        ) : (
          typeClients.map(client => (
            <ClientPortrait
              key={client.id}
              client={client}
              borderColor={config.borderColor}
              type={type}
            />
          ))
        )}
      </ScrollView>

      {/* Passive bonus description */}
      <Text style={styles.bonusText}>{config.bonusText}</Text>
    </View>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function ClientelaPanel() {
  const clients = useGameStore(s => s.clients);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.panelHeader}>CLIENTELA — YOUR NETWORK</Text>

      {CLIENT_TYPE_ORDER.map(type => (
        <TrackerRow key={type} type={type} clients={clients} />
      ))}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  panelHeader: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 10,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },

  // ── Tracker row ────────────────────────────────────────────────────────────
  trackerRow: {
    marginBottom: SPACING.lg,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rowLabel: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
  },
  rowCount: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.gold,
  },

  // ── Client scroll ─────────────────────────────────────────────────────────
  clientScrollContent: {
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },

  // ── Client card ────────────────────────────────────────────────────────────
  clientCard: {
    width: 72,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  portrait: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderRadius: RADIUS.sm,
  },
  portraitFallback: {
    backgroundColor: COLORS.panelElevated,
  },
  clientName: {
    marginTop: 4,
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
    textAlign: 'center',
    width: 72,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyCard: {
    width: 72,
    height: 90,
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
  },

  // ── Bonus description ──────────────────────────────────────────────────────
  bonusText: {
    marginTop: SPACING.xs,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.dust,
  },
});
