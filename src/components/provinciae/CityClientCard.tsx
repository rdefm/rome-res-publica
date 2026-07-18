import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import type { CityClientDefinition } from '../../models/city';
import type { CityState } from '../../models/city';
import { getClientsForCity } from '../../data/cityClients';

// ─── Component ────────────────────────────────────────────────────────────────

interface CityClientCardProps {
  province: CityState;
  recruitedClientIds: string[];
  onRecruit: (clientId: string) => void;
}

export default function CityClientCard({
  province,
  recruitedClientIds,
  onRecruit,
}: CityClientCardProps) {
  const clients = getClientsForCity(province.id);

  if (clients.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No provincial clients available in this territory.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Recruit provincial clients through ambassador actions or event card outcomes.
        Requirements reflect Local Support and Relationship thresholds.
      </Text>

      {clients.map(client => {
        const isRecruited = recruitedClientIds.includes(client.id);
        const meetsSupport = province.localSupport >= client.supportRequired;
        const meetsRelationship = province.relationshipScore >= client.relationshipRequired;
        const canRecruit = meetsSupport && meetsRelationship && !isRecruited;

        return (
          <ClientCard
            key={client.id}
            client={client}
            isRecruited={isRecruited}
            meetsSupport={meetsSupport}
            meetsRelationship={meetsRelationship}
            canRecruit={canRecruit}
            currentSupport={province.localSupport}
            currentRelationship={province.relationshipScore}
            onRecruit={() => onRecruit(client.id)}
          />
        );
      })}
    </View>
  );
}

function ClientCard({
  client,
  isRecruited,
  meetsSupport,
  meetsRelationship,
  canRecruit,
  currentSupport,
  currentRelationship,
  onRecruit,
}: {
  client: CityClientDefinition;
  isRecruited: boolean;
  meetsSupport: boolean;
  meetsRelationship: boolean;
  canRecruit: boolean;
  currentSupport: number;
  currentRelationship: number;
  onRecruit: () => void;
}) {
  return (
    <View
      style={[
        styles.card,
        isRecruited && styles.cardRecruited,
        !canRecruit && !isRecruited && styles.cardLocked,
      ]}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.clientName}>{client.name}</Text>
          <Text style={styles.clientProvince}>{client.provinceId.replace('_', ' ').toUpperCase()}</Text>
        </View>
        {isRecruited && (
          <View style={styles.recruitedBadge}>
            <Text style={styles.recruitedText}>RECRUITED</Text>
          </View>
        )}
        {!isRecruited && !canRecruit && (
          <View style={styles.lockedBadge}>
            <Text style={styles.lockedText}>LOCKED</Text>
          </View>
        )}
      </View>

      {/* Bonus */}
      <Text style={styles.bonusText}>{client.bonusDescription}</Text>

      {/* Requirements */}
      <View style={styles.requirements}>
        <Requirement
          label="Local Support"
          required={client.supportRequired}
          current={currentSupport}
          met={meetsSupport}
        />
        <Requirement
          label="Relationship"
          required={client.relationshipRequired}
          current={currentRelationship}
          met={meetsRelationship}
        />
      </View>

      {/* Recruit button — only shows when conditions met and not yet recruited */}
      {canRecruit && (
        <TouchableOpacity
          style={styles.recruitButton}
          onPress={onRecruit}
          activeOpacity={0.75}
        >
          <Text style={styles.recruitButtonText}>Recruit via Diplomat's Desk · 20 Gratia</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Requirement({
  label,
  required,
  current,
  met,
}: {
  label: string;
  required: number;
  current: number;
  met: boolean;
}) {
  return (
    <View style={styles.reqRow}>
      <Text style={[styles.reqLabel, met ? styles.reqMet : styles.reqNotMet]}>
        {met ? '✓' : '✗'} {label}: {current} / {required}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
  } as ViewStyle,

  intro: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: SPACING.md,
  } as TextStyle,

  card: {
    backgroundColor: '#2a2218',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  cardRecruited: {
    borderColor: COLORS.laurel,
    backgroundColor: '#1a2818',
  } as ViewStyle,

  cardLocked: {
    opacity: 0.65,
  } as ViewStyle,

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  } as ViewStyle,

  clientName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,

  clientProvince: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 1,
  } as TextStyle,

  recruitedBadge: {
    backgroundColor: '#1a3020',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.laurel,
  } as ViewStyle,

  recruitedText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  } as TextStyle,

  lockedBadge: {
    backgroundColor: '#2a1818',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  lockedText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  } as TextStyle,

  bonusText: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  } as TextStyle,

  requirements: {
    gap: 3,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  reqRow: {} as ViewStyle,

  reqLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    lineHeight: 16,
  } as TextStyle,

  reqMet: {
    color: COLORS.laurel,
  } as TextStyle,

  reqNotMet: {
    color: COLORS.crimson,
  } as TextStyle,

  recruitButton: {
    backgroundColor: '#1a2818',
    borderRadius: 4,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    marginTop: 4,
  } as ViewStyle,

  recruitButtonText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,

  empty: {
    padding: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,

  emptyText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  } as TextStyle,
});
