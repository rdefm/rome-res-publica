import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { EventDef, EventInstance, EventChoice } from '../../models/event';
import type { ClientType } from '../../models/client';
import { generateClientName } from '../../data/clientNames';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Asset map ───────────────────────────────────────────────────────────────

const EVENT_IMAGES: Record<string, ReturnType<typeof require> | null> = {
  'portrait-paterfamilias': (() => {
    try { return require('../../assets/images/portrait-paterfamilias.png'); } catch { return null; }
  })(),
  'marius-plumber': (() => {
    try { return require('../../assets/images/marius-plumber.png'); } catch { return null; }
  })(),
};

// ─── Client type label map ────────────────────────────────────────────────────

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  muscle: 'Muscle',
  publicSupport: 'Public Support',
  votingSway: 'Voting Sway',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventCardProps {
  def: EventDef;
  instance: EventInstance;
  onChoiceMade: (choiceId: string, previewClientName?: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventCard({ def, instance, onChoiceMade }: EventCardProps) {
  const clients = useGameStore(s => s.clients);

  // Addition 2 — Class A name pre-generation
  // For Class A events, EventInstance.clientName is undefined at injection.
  // Pre-generate a candidate name at render time so the body shows a real name
  // before the player commits. Run once per card (dep: defId).
  const [previewClientName, setPreviewClientName] = useState<string | null>(null);

  useEffect(() => {
    const acquisitionChoice = def.choices.find(c =>
      c.successEffect?.startsWith('addClient:')
    );
    if (acquisitionChoice && !instance.clientName) {
      const type = acquisitionChoice.successEffect.split(':')[1] as ClientType;
      const name = generateClientName(type, clients);
      setPreviewClientName(name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id]); // run once per card, not on every render

  // Addition 3 — Body text interpolation
  const resolvedBody = def.bodyText
    .replace('{clientName}', instance.clientName ?? previewClientName ?? 'a stranger')
    .replace('{clientType}', instance.clientType ?? 'client');

  const imageSource = EVENT_IMAGES[def.imageKey] ?? null;

  return (
    <View style={styles.card}>
      {/* Event image */}
      {imageSource && (
        <Image source={imageSource} style={styles.eventImage} />
      )}

      {/* Title */}
      <Text style={styles.title}>{def.title}</Text>

      {/* Body */}
      <Text style={styles.body}>{resolvedBody}</Text>

      {/* Choices */}
      <View style={styles.choicesContainer}>
        {def.choices.map(choice => (
          <ChoiceButton
            key={choice.id}
            choice={choice}
            clients={clients}
            onPress={() => onChoiceMade(choice.id, previewClientName ?? undefined)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Choice button ────────────────────────────────────────────────────────────

function ChoiceButton({
  choice,
  clients,
  onPress,
}: {
  choice: EventChoice;
  clients: Array<{ type: ClientType; [key: string]: any }>;
  onPress: () => void;
}) {
  // Addition 1 — requiresClient disabled state
  const isDisabledByClient = !!choice.requiresClient &&
    clients.filter(c => c.type === choice.requiresClient).length === 0;

  const hasSkillCheck = !!choice.skillCheck;

  return (
    <View style={styles.choiceWrapper}>
      <TouchableOpacity
        style={[
          styles.choiceBtn,
          isDisabledByClient && styles.choiceBtnDisabled,
        ]}
        onPress={onPress}
        disabled={isDisabledByClient}
        activeOpacity={0.75}
      >
        <Text style={styles.choiceLabel}>{choice.label || 'Acknowledge'}</Text>
        {hasSkillCheck && (
          <Text style={styles.skillCheckHint}>
            {choice.skillCheck!.skill} ≥ {choice.skillCheck!.difficulty}
          </Text>
        )}
      </TouchableOpacity>

      {/* Disabled tooltip — shown only when gated by missing client */}
      {isDisabledByClient && choice.requiresClient && (
        <Text style={styles.clientRequiredTag}>
          Requires a {CLIENT_TYPE_LABELS[choice.requiresClient]} client.
        </Text>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  eventImage: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.marble,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: SPACING.md,
  },
  choicesContainer: {
    gap: SPACING.sm,
  },

  // ── Choice button ──────────────────────────────────────────────────────────
  choiceWrapper: {
    // wraps button + optional disabled tag
  },
  choiceBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  choiceBtnDisabled: {
    opacity: 0.4,
  },
  choiceLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
  },
  skillCheckHint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Disabled client tag ────────────────────────────────────────────────────
  clientRequiredTag: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: SPACING.sm,
  },
});
