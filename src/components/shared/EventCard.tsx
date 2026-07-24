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
  const dismissEvent = useGameStore(s => s.dismissEvent);
  // Phase 5, Chunk P5-E — lets static event content reference the actual
  // playing family (e.g. '{gensPlural}' -> 'Duilii') via the same
  // interpolation chain {clientName}/{clientType} already established here.
  const gensName = useGameStore(s => s.gensName);
  const gensSurname = useGameStore(s => s.gensSurname);
  const gensPlural = useGameStore(s => s.gensPlural);

  // P1-G: result text state — shown after a terminal, no-skill-check choice is made
  const [pendingChoice, setPendingChoice] = useState<{
    choice: EventChoice;
    previewClientName?: string;
  } | null>(null);

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
  // instance.bodyText (set by injectNoticeEvent-style dynamic injections — P2-B
  // tier-up, P2-D leader death, P2-F grand acts) overrides the static def body.
  // Previously this field was set by npcConsulEngine but never read here — fixed
  // in P2-B so dynamic interpolation actually reaches the player.
  const resolvedBody = (instance.bodyText ?? def.bodyText)
    .replace('{clientName}', instance.clientName ?? previewClientName ?? 'a stranger')
    .replace('{clientType}', instance.clientType ?? 'client')
    .replace('{gensName}', gensName)
    .replace('{gensSurname}', gensSurname)
    .replace('{gensPlural}', gensPlural);

  const imageSource = EVENT_IMAGES[def.imageKey] ?? null;

  // P1-G: if the choice has successText and no skill check, show result text
  // before resolving (outcome is deterministic — no skill check means always success).
  // Skill-check choices resolve immediately (outcome not known until engine runs).
  function handleChoicePress(choice: EventChoice, preview?: string) {
    if (choice.successText && !choice.skillCheck) {
      setPendingChoice({ choice, previewClientName: preview });
    } else {
      onChoiceMade(choice.id, preview);
    }
  }

  function handleContinue() {
    if (!pendingChoice) return;
    onChoiceMade(pendingChoice.choice.id, pendingChoice.previewClientName);
    setPendingChoice(null);
  }

  return (
    <View style={styles.card}>
      {/* Event image */}
      {imageSource && (
        <Image source={imageSource} style={styles.eventImage} />
      )}

      {/* Title */}
      <Text style={styles.title}>{instance.title ?? def.title}</Text>

      {/* Body */}
      <Text style={styles.body}>{resolvedBody}</Text>

      {/* Result text (shown after choice made) or choices */}
      {pendingChoice ? (
        <View style={styles.resultView}>
          <Text style={styles.resultText}>{pendingChoice.choice.successText}</Text>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.75}>
            <Text style={styles.continueTxt}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.choicesContainer}>
          {def.choices.map(choice => (
            <ChoiceButton
              key={choice.id}
              choice={choice}
              clients={clients}
              onPress={() => handleChoicePress(choice, previewClientName ?? undefined)}
            />
          ))}
        </View>
      )}
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

  // ── Result text (P1-G) ────────────────────────────────────────────────────
  resultView: {
    marginTop: SPACING.sm,
  },
  resultText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  continueBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  continueTxt: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
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
