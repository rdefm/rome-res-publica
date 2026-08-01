// AmbitionBuilder — the player-authored ambition builder (ambition rework,
// ticket 02). Criterion picker → per-criterion detail inputs → deadline →
// live difficulty/reward readout → confirm. Opened from an empty/occupied
// slot on the Agenda Tablet's Ambitiones leaf (AgendaTablet.tsx), never
// mounted standalone.
//
// The live readout and the committed ambition are computed by the exact
// same pure function (buildAmbition) — the number shown here before commit
// IS the number the player receives on completion (spec: "the reward I was
// shown in the builder is the reward I actually receive").
//
// Deliberately reads store state via useGameStore.getState() (a snapshot),
// not a subscribed selector — same idiom as AgendaTablet's own
// generateAgenda(useGameStore.getState()) call. This form's live readout
// only needs to react to the player's own inputs (local useState), not to
// concurrent store writes; a subscribed bare/broad selector would violate
// CLAUDE.md's field-level-selector rule for no benefit, since nothing can
// change game state while this modal is in front.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { buildAmbition, nextEligibleElectionTurns, describeCriterionTitle } from '../../engine/ambitionEngine';
import type { BuildAmbitionInput } from '../../engine/ambitionEngine';
import type { AmbitionCriterion, AmbitionCriterionId, AmbitionScope } from '../../models/ambition';
import type { OfficeId } from '../../models/office';
import type { RegionId } from '../../models/theatre';
import { OFFICES, TRIBUNE_OFFICE } from '../../data/offices';
import { BALANCE } from '../../data/balance';
import { ASSET_DEFINITIONS } from '../../data/assetDefinitions';
import { REGIONS } from '../../data/theatreMap';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ScrollModal, { PARCHMENT } from './ScrollModal';

interface Props {
  visible: boolean;
  scope: AmbitionScope;
  onClose: () => void;
}

// ─── Criterion vocabulary (spec §2.2 — nine, closed set) ──────────────────────

const CRITERION_OPTIONS: { id: AmbitionCriterionId; label: string; icon: string }[] = [
  { id: 'resource_threshold', label: 'Hold Denarii / Fides', icon: '💰' },
  { id: 'office_held',        label: 'Win an Office',        icon: '🏛️' },
  { id: 'clan_standing',      label: 'Reach Clan Standing',  icon: '🤝' },
  { id: 'asset_tier',         label: 'Own an Asset',         icon: '🏗️' },
  { id: 'client_count',       label: 'Hold Clients',         icon: '👥' },
  { id: 'battles_won',        label: 'Win Battles',          icon: '⚔️' },
  { id: 'region_control',     label: 'Take a Region',        icon: '🗺️' },
  { id: 'survive_seasons',    label: 'Keep the Gens Intact', icon: '🕊️' },
  { id: 'trial_won',          label: 'Win Trials',           icon: '⚖️' },
];

const OFFICE_IDS = Object.keys(BALANCE.ambitions.officeBaseline) as OfficeId[];

function getOffice(id: OfficeId) {
  return id === 'tribune' ? TRIBUNE_OFFICE : OFFICES.find(o => o.id === id);
}

const BUILDER_ASSETS = ASSET_DEFINITIONS.filter(a => a.scope === 'latium' || a.scope === 'everywhere');

// Step/min per plain-amount criterion — asset_tier (1-3 tier picker) and
// office_held/region_control/survive_seasons (special-cased UI) are absent.
const AMOUNT_CONFIG: Partial<Record<AmbitionCriterionId, { step: number; min: number; default: number }>> = {
  resource_threshold: { step: 50, min: 50, default: 200 },
  clan_standing:      { step: 10, min: 10, default: 30 },
  client_count:       { step: 1,  min: 1,  default: 3 },
  battles_won:        { step: 1,  min: 1,  default: 2 },
  trial_won:          { step: 1,  min: 1,  default: 2 },
  survive_seasons:    { step: 2,  min: 2,  default: 8 },
};

const DEFAULT_DEADLINE_SEASONS = 4;

// ─── Component ──────────────────────────────────────────────────────────────

export default function AmbitionBuilder({ visible, scope, onClose }: Props) {
  const setAmbitionAction = useGameStore(s => s.setAmbition);
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const player = family.find(c => c.isPlayer);
  const assignedCharacterId = scope === 'character' ? player?.id : undefined;

  const [criterionId, setCriterionId] = useState<AmbitionCriterionId>('resource_threshold');
  const [resource, setResource] = useState<'denarii' | 'fides'>('denarii');
  const [officeId, setOfficeId] = useState<OfficeId>(OFFICE_IDS[0]);
  const [officeDeadlineTurn, setOfficeDeadlineTurn] = useState<number | null>(null);
  const [clanId, setClanId] = useState<string | null>(clans[0]?.id ?? null);
  const [assetId, setAssetId] = useState<string>(BUILDER_ASSETS[0]?.id ?? '');
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [regionId, setRegionId] = useState<RegionId | null>(REGIONS[0]?.id ?? null);
  const [amount, setAmount] = useState<number>(AMOUNT_CONFIG.resource_threshold!.default);
  const [deadlineSeasons, setDeadlineSeasons] = useState<number>(DEFAULT_DEADLINE_SEASONS);

  function selectCriterion(id: AmbitionCriterionId) {
    setCriterionId(id);
    const cfg = AMOUNT_CONFIG[id];
    if (cfg) setAmount(cfg.default);
    if (id === 'office_held') setOfficeDeadlineTurn(null);
  }

  // ─── Build the criterion + input for both the preview and the commit ──────

  function buildCriterion(): AmbitionCriterion {
    switch (criterionId) {
      case 'resource_threshold': return { id: 'resource_threshold', resource, amount };
      case 'office_held':        return { id: 'office_held', officeId };
      case 'clan_standing':      return { id: 'clan_standing', clanId: clanId ?? undefined, amount };
      case 'asset_tier':         return { id: 'asset_tier', assetId, amount: tier };
      case 'client_count':       return { id: 'client_count', amount };
      case 'battles_won':        return { id: 'battles_won', amount };
      case 'region_control':     return { id: 'region_control', regionId: regionId ?? undefined };
      case 'survive_seasons':    return { id: 'survive_seasons', amount };
      case 'trial_won':          return { id: 'trial_won', amount };
    }
  }

  // Delegates to the shared engine helper (ambitionEngine.describeCriterionTitle)
  // so the builder's title and a direct-write/offer narrative-hook token
  // (resourceEngine.ts, ticket 05) can never phrase the same criterion two
  // different ways.
  function criterionTitle(): string {
    return describeCriterionTitle(buildCriterion(), state);
  }

  const state = useGameStore.getState();

  // Whether every required field for the current criterion is filled.
  const isReady =
    (criterionId !== 'office_held' || officeDeadlineTurn !== null) &&
    (criterionId !== 'clan_standing' || !!clanId) &&
    (criterionId !== 'region_control' || !!regionId) &&
    (criterionId !== 'asset_tier' || !!assetId);

  const resolvedDeadlineSeasons =
    criterionId === 'office_held'
      ? (officeDeadlineTurn !== null ? officeDeadlineTurn - state.turnNumber : undefined)
      : criterionId === 'survive_seasons'
      ? amount
      : deadlineSeasons;

  const previewInput: BuildAmbitionInput = {
    scope,
    source: 'player',
    title: criterionTitle(),
    criterion: buildCriterion(),
    assignedCharacterId,
    deadlineSeasons: resolvedDeadlineSeasons,
  };

  const preview = isReady ? buildAmbition(previewInput, state) : null;

  function handleConfirm() {
    if (!isReady) return;
    setAmbitionAction(previewInput);
    onClose();
  }

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={scope === 'family' ? 'FAMILY AMBITION' : 'CHARACTER AMBITION'}
      subtitle="Choose a goal, set your own target, and see the reward before you commit."
      animationType="fade"
    >
      <Text style={styles.sectionLabel}>CRITERION</Text>
      <View style={styles.criterionGrid}>
        {CRITERION_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.criterionChip, criterionId === opt.id && styles.criterionChipSelected]}
            onPress={() => selectCriterion(opt.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.criterionIcon}>{opt.icon}</Text>
            <Text style={[styles.criterionLabel, criterionId === opt.id && styles.criterionLabelSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>DETAIL</Text>
      {criterionId === 'resource_threshold' && (
        <>
          <ChoiceRow>
            <Choice label="Denarii" selected={resource === 'denarii'} onPress={() => setResource('denarii')} />
            <Choice label="Fides" selected={resource === 'fides'} onPress={() => setResource('fides')} />
          </ChoiceRow>
          <AmountStepper
            value={amount}
            step={AMOUNT_CONFIG.resource_threshold!.step}
            min={AMOUNT_CONFIG.resource_threshold!.min}
            onChange={setAmount}
            suffix={resource === 'fides' ? 'Fides' : 'Denarii'}
          />
        </>
      )}
      {criterionId === 'office_held' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {OFFICE_IDS.map(id => (
            <Choice
              key={id}
              label={getOffice(id)?.name ?? id}
              selected={officeId === id}
              onPress={() => { setOfficeId(id); setOfficeDeadlineTurn(null); }}
            />
          ))}
        </ScrollView>
      )}
      {criterionId === 'clan_standing' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {clans.map(c => (
              <Choice key={c.id} label={c.name} selected={clanId === c.id} onPress={() => setClanId(c.id)} />
            ))}
          </ScrollView>
          <AmountStepper
            value={amount}
            step={AMOUNT_CONFIG.clan_standing!.step}
            min={AMOUNT_CONFIG.clan_standing!.min}
            onChange={setAmount}
            suffix="standing"
          />
        </>
      )}
      {criterionId === 'asset_tier' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {BUILDER_ASSETS.map(a => (
              <Choice key={a.id} label={a.name} selected={assetId === a.id} onPress={() => setAssetId(a.id)} />
            ))}
          </ScrollView>
          <ChoiceRow>
            {[1, 2, 3].map(t => (
              <Choice key={t} label={`Tier ${t}`} selected={tier === t} onPress={() => setTier(t as 1 | 2 | 3)} />
            ))}
          </ChoiceRow>
        </>
      )}
      {criterionId === 'client_count' && (
        <AmountStepper
          value={amount}
          step={AMOUNT_CONFIG.client_count!.step}
          min={AMOUNT_CONFIG.client_count!.min}
          onChange={setAmount}
          suffix="clients"
        />
      )}
      {criterionId === 'battles_won' && (
        <AmountStepper
          value={amount}
          step={AMOUNT_CONFIG.battles_won!.step}
          min={AMOUNT_CONFIG.battles_won!.min}
          onChange={setAmount}
          suffix="battles"
        />
      )}
      {criterionId === 'region_control' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {REGIONS.map(r => (
            <Choice key={r.id} label={r.name} selected={regionId === r.id} onPress={() => setRegionId(r.id)} />
          ))}
        </ScrollView>
      )}
      {criterionId === 'survive_seasons' && (
        <AmountStepper
          value={amount}
          step={AMOUNT_CONFIG.survive_seasons!.step}
          min={AMOUNT_CONFIG.survive_seasons!.min}
          onChange={setAmount}
          suffix="more seasons"
        />
      )}
      {criterionId === 'trial_won' && (
        <AmountStepper
          value={amount}
          step={AMOUNT_CONFIG.trial_won!.step}
          min={AMOUNT_CONFIG.trial_won!.min}
          onChange={setAmount}
          suffix="trials"
        />
      )}

      {/* Deadline — mandatory on every player-set ambition (spec). office_held
          is clamped to actually-reachable Winter elections; survive_seasons's
          own amount above IS its deadline (no separate control needed). */}
      {criterionId !== 'survive_seasons' && (
        <>
          <Text style={styles.sectionLabel}>DEADLINE</Text>
          {criterionId === 'office_held' ? (
            <View style={styles.choiceRow}>
              {nextEligibleElectionTurns(officeId, state).map(turn => (
                <Choice
                  key={turn}
                  label={`In ${turn - state.turnNumber} seasons`}
                  selected={officeDeadlineTurn === turn}
                  onPress={() => setOfficeDeadlineTurn(turn)}
                />
              ))}
            </View>
          ) : (
            <AmountStepper value={deadlineSeasons} step={1} min={1} onChange={setDeadlineSeasons} suffix="seasons" />
          )}
        </>
      )}

      <Text style={styles.sectionLabel}>READOUT</Text>
      <View style={styles.readout}>
        {preview ? (
          <>
            <Text style={styles.readoutTitle}>{preview.title}</Text>
            <Text style={styles.readoutLine}>
              Reward: {rewardSummary(preview.reward) || 'negligible'}
            </Text>
            <Text style={styles.readoutLineMuted}>
              Miss the deadline: {preview.failureDignitas} Dignitas
            </Text>
          </>
        ) : (
          <Text style={styles.readoutLineMuted}>Choose every detail above to see the reward.</Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !isReady && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!isReady}
        >
          <Text style={styles.confirmText}>Set This Ambition</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollModal>
  );
}

function rewardSummary(reward: { lifetimeDignitas?: number; fides?: number; denarii?: number }): string {
  const parts: string[] = [];
  if (reward.lifetimeDignitas) parts.push(`+${reward.lifetimeDignitas} Dignitas`);
  if (reward.fides) parts.push(`+${reward.fides} Fides`);
  if (reward.denarii) parts.push(`+${reward.denarii} Denarii`);
  return parts.join(' · ');
}

// ─── Small reusable controls ────────────────────────────────────────────────

function ChoiceRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.choiceRow}>{children}</View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AmountStepper({
  value, step, min, onChange, suffix,
}: {
  value: number; step: number; min: number; onChange: (v: number) => void; suffix: string;
}) {
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onChange(Math.max(min, value - step))}
        activeOpacity={0.7}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value} {suffix}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value + step)} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionLabel: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  criterionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  criterionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,168,112,0.2)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  criterionChipSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(200,168,112,0.4)',
  },
  criterionIcon: { fontSize: 12 },
  criterionLabel: { color: PARCHMENT.body, fontFamily: FONTS.ui, fontSize: 11 },
  criterionLabelSelected: { color: PARCHMENT.heading, fontWeight: '700' },

  hScroll: { marginBottom: SPACING.xs },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
  choice: {
    backgroundColor: 'rgba(200,168,112,0.2)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginRight: SPACING.xs,
  },
  choiceSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(200,168,112,0.4)',
  },
  choiceText: { color: PARCHMENT.body, fontFamily: FONTS.ui, fontSize: 11 },
  choiceTextSelected: { color: PARCHMENT.heading, fontWeight: '700' },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,168,112,0.25)',
  },
  stepperBtnText: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 18 },
  stepperValue: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 15, minWidth: 110, textAlign: 'center' },

  readout: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  readoutTitle: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 14, marginBottom: 4 },
  readoutLine: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 12, marginBottom: 2 },
  readoutLineMuted: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12 },

  footer: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  confirmBtn: {
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4, borderColor: PARCHMENT.border },
  confirmText: { color: PARCHMENT.gold, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: SPACING.xs },
  cancelText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 12 },
});
