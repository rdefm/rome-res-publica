import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { ClientType, Client, ClientBonus } from '../../models/client';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Asset map ───────────────────────────────────────────────────────────────

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
}> = {
  muscle:        { emoji: '🛡️', label: 'MUSCLE',         borderColor: COLORS.crimson },
  publicSupport: { emoji: '📣', label: 'PUBLIC SUPPORT',  borderColor: COLORS.laurel },
  votingSway:    { emoji: '🗳️', label: 'VOTING SWAY',     borderColor: COLORS.gold },
};

const CLIENT_TYPE_ORDER: ClientType[] = ['muscle', 'publicSupport', 'votingSway'];

// ─── Bonus pill labels ────────────────────────────────────────────────────────

const BONUS_LABELS: Record<keyof ClientBonus, string> = {
  gold:               '🪙 Gold',
  gratia:             '🤝 Gratia',
  dignitas:           '⭐ Dignitas',
  gravitas:           '⚖ Gravitas',
  trialDefenseBonus:  '🛡 Defence',
  corruptionShield:   '🔒 Corruption',
  rhetoricalBonus:    '📜 Rhetoric',
  martialBonus:       '⚔ Martial',
};

function BonusPills({ bonus }: { bonus: ClientBonus }) {
  const entries = Object.entries(bonus) as [keyof ClientBonus, number][];
  if (entries.length === 0) return null;

  return (
    <View style={styles.bonusPillRow}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.bonusPill}>
          <Text style={styles.bonusPillText}>
            {BONUS_LABELS[key]} +{value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Client detail card ───────────────────────────────────────────────────────

function ClientDetailCard({ client, borderColor }: { client: Client; borderColor: string }) {
  const asset = PORTRAIT_ASSETS[client.type];

  return (
    <View style={[styles.clientDetailCard, { borderColor }]}>
      {/* Portrait */}
      <View style={[styles.portrait, { borderColor }]}>
        {asset ? (
          <Image source={asset} style={styles.portraitImage} />
        ) : (
          <View style={styles.portraitFallback} />
        )}
      </View>

      {/* Info */}
      <View style={styles.clientInfo}>
        <Text style={styles.clientName} numberOfLines={1}>
          {client.name}
          {client.flavourTitle ? <Text style={styles.clientFlavourTitle}> · {client.flavourTitle}</Text> : null}
        </Text>
        {client.flavourText ? (
          <Text style={styles.clientFlavourText} numberOfLines={2}>{client.flavourText}</Text>
        ) : null}
        <BonusPills bonus={client.bonus} />
      </View>
    </View>
  );
}

// ─── Tracker row ──────────────────────────────────────────────────────────────

function TrackerRow({ type, clients }: { type: ClientType; clients: Client[] }) {
  const config = TYPE_CONFIG[type];
  const typeClients = clients.filter(c => c.type === type);
  const count = typeClients.length;

  return (
    <View style={styles.trackerRow}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{config.emoji} {config.label}</Text>
        <Text style={styles.rowCount}>[{count}]</Text>
      </View>

      {count === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>None yet</Text>
        </View>
      ) : (
        typeClients.map(client => (
          <ClientDetailCard
            key={client.id}
            client={client}
            borderColor={config.borderColor}
          />
        ))
      )}
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
  scroll: { flex: 1 },
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

  // ── Client detail card ────────────────────────────────────────────────────
  clientDetailCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: 'flex-start',
  },
  portrait: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  portraitImage: {
    width: 56,
    height: 56,
    resizeMode: 'cover',
  },
  portraitFallback: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.panelSurface,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.marble,
    fontWeight: '600',
  },
  clientFlavourTitle: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    fontWeight: 'normal',
  },
  clientFlavourText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  },

  // ── Bonus pills ────────────────────────────────────────────────────────────
  bonusPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  bonusPill: {
    backgroundColor: COLORS.laurel,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bonusPillText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.marble,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyCard: {
    height: 56,
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
});
