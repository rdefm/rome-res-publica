// ─── City Event Modal (July 2026 fixes, Chunk D) ─────────────────────────────
// Presents state.activeCityEvent — a governor or ambassador situational card
// from data/cityEvents.ts's CITY_EVENTS pool, fired either by cityEngine's
// passive per-season roll (rollCityEventTick) or by the Ambassador's
// "Arrange Cultural Exchange" action's guaranteed fire. Deliberately its own
// modal rather than reusing EventModal/EventCard: CityEventDefinition is a
// distinct shape (city-scoped rel/localSupport/infra/corruption effects, not
// player-resource ones) with its own resolver (cityEngine.resolveCityEventEffect).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { getCityEventDef } from '../../data/cityEvents';
import type { CityEventOption } from '../../models/city';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';

export default function CityEventModal() {
  const activeCityEvent = useGameStore(s => s.activeCityEvent);
  const cities = useGameStore(s => s.cities);
  const fides = useGameStore(s => s.fides);
  const denarii = useGameStore(s => s.denarii);
  const imperium = useGameStore(s => s.imperium);
  const resolveCityEventChoice = useGameStore(s => s.resolveCityEventChoice);
  const dismissCityEvent = useGameStore(s => s.dismissCityEvent);

  if (!activeCityEvent) return null;

  const def = getCityEventDef(activeCityEvent.defId);
  const city = cities.find(c => c.id === activeCityEvent.cityId);
  if (!def || !city) return null;

  const roleLabel = def.triggerCondition === 'governor' ? "GOVERNOR'S DESK" : "AMBASSADOR'S DESK";

  function canAfford(option: CityEventOption): boolean {
    if (!option.cost) return true;
    if (option.cost.resource === 'denarii') return denarii >= option.cost.amount;
    if (option.cost.resource === 'fides')   return fides   >= option.cost.amount;
    if (option.cost.resource === 'imperium') return imperium >= option.cost.amount;
    return true;
  }

  return (
    <ScrollModal
      visible={!!activeCityEvent}
      onClose={dismissCityEvent}
      title={roleLabel}
      subtitle={city.id}
      animationType="fade"
    >
      <View style={styles.card}>
        <Text style={styles.title}>{def.title}</Text>
        <Text style={styles.body}>{def.description}</Text>

        <View style={styles.choicesContainer}>
          {def.options.map(option => {
            const affordable = canAfford(option);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.choiceBtn, !affordable && styles.choiceBtnDisabled]}
                onPress={() => affordable && resolveCityEventChoice(option.id)}
                disabled={!affordable}
                activeOpacity={0.75}
              >
                <Text style={styles.choiceLabel}>{option.label}</Text>
                {option.skillCheck && (
                  <Text style={styles.hint}>
                    {option.skillCheck.skill} ≥ {option.skillCheck.difficulty}
                  </Text>
                )}
                {!affordable && option.cost && (
                  <Text style={styles.hint}>
                    Requires {option.cost.amount} {option.cost.resource === 'denarii' ? 'Gold' : option.cost.resource === 'fides' ? 'Fides' : 'Imperium'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.dismissBtn} onPress={dismissCityEvent} activeOpacity={0.75}>
          <Text style={styles.dismissTxt}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </ScrollModal>
  );
}

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
  hint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  dismissTxt: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 12,
    letterSpacing: 1,
  },
});
