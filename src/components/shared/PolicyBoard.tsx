import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import InfoTap from '../shared/InfoTap';
import type {
  GovernorPolicy,
  TaxationNotch,
  SecurityNotch,
  DevelopmentNotch,
} from '../../models/province';
import {
  TAXATION_GOLD_MULT,
  TAXATION_REL_PER_YEAR,
  TAXATION_CORRUPTION_PER_TURN,
  SECURITY_IMPERIUM_BASE,
  SECURITY_REVOLT_DELTA,
  DEVELOPMENT_INFRA_DELTA,
  DEVELOPMENT_REL_PER_YEAR,
} from '../../models/province';

// ─── Data tables ─────────────────────────────────────────────────────────────

const TAXATION_NOTCHES: TaxationNotch[] = [
  'benevolent', 'light', 'standard', 'heavy', 'extortionate',
];
const TAXATION_LABELS: Record<TaxationNotch, string> = {
  benevolent:   'Benevolent',
  light:        'Light',
  standard:     'Standard',
  heavy:        'Heavy',
  extortionate: 'Extortionate',
};

const SECURITY_NOTCHES: SecurityNotch[] = [
  'neglect', 'light_patrol', 'standard_garrison', 'heavy_garrison', 'full_occupation',
];
const SECURITY_LABELS: Record<SecurityNotch, string> = {
  neglect:           'Neglect',
  light_patrol:      'Light Patrol',
  standard_garrison: 'Garrison',
  heavy_garrison:    'Heavy Garrison',
  full_occupation:   'Occupation',
};

const DEVELOPMENT_NOTCHES: DevelopmentNotch[] = [
  'exploit', 'neglect', 'maintain', 'invest', 'major_works',
];
const DEVELOPMENT_LABELS: Record<DevelopmentNotch, string> = {
  exploit:     'Exploit',
  neglect:     'Neglect',
  maintain:    'Maintain',
  invest:      'Invest',
  major_works: 'Major Works',
};

// ─── Sub-component: AxisSlider ────────────────────────────────────────────────

interface AxisSliderProps<T extends string> {
  label: string;
  notches: T[];
  labels: Record<T, string>;
  current: T;
  onChange: (value: T) => void;
  renderSummary: (value: T) => string;
  disabled?: boolean;
}

function AxisSlider<T extends string>({
  label,
  notches,
  labels,
  current,
  onChange,
  renderSummary,
  disabled = false,
}: AxisSliderProps<T>) {
  const currentIdx = notches.indexOf(current);

  return (
    <View style={styles.axisContainer}>
      <View style={styles.axisHeader}>
        <Text style={styles.axisLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.axisSummary}>{renderSummary(current)}</Text>
      </View>

      {/* Track */}
      <View style={styles.track}>
        {notches.map((notch, idx) => {
          const isActive = idx === currentIdx;
          const isPassed = idx < currentIdx;
          return (
            <TouchableOpacity
              key={notch}
              onPress={() => !disabled && onChange(notch)}
              style={styles.notchWrapper}
              disabled={disabled}
              activeOpacity={0.7}
            >
              {/* Connecting line */}
              {idx < notches.length - 1 && (
                <View
                  style={[
                    styles.trackLine,
                    isPassed || isActive ? styles.trackLineActive : styles.trackLineInactive,
                  ]}
                />
              )}
              {/* Notch circle */}
              <View
                style={[
                  styles.notchCircle,
                  isActive && styles.notchCircleActive,
                  isPassed && styles.notchCirclePassed,
                  disabled && styles.notchCircleDisabled,
                ]}
              />
              {/* Label below */}
              <Text
                style={[
                  styles.notchLabel,
                  isActive && styles.notchLabelActive,
                ]}
                numberOfLines={2}
              >
                {labels[notch]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main PolicyBoard ─────────────────────────────────────────────────────────

interface PolicyBoardProps {
  policy: GovernorPolicy;
  onPolicyChange: (policy: GovernorPolicy) => void;
  governorMartial: number;
  readOnly?: boolean;
}

export default function PolicyBoard({
  policy,
  onPolicyChange,
  governorMartial,
  readOnly = false,
}: PolicyBoardProps) {

  function taxationSummary(val: TaxationNotch): string {
    const goldPct = Math.round((TAXATION_GOLD_MULT[val] - 1) * 100);
    const rel = TAXATION_REL_PER_YEAR[val];
    const corr = TAXATION_CORRUPTION_PER_TURN[val];
    const goldStr = goldPct === 0 ? 'Base Gold' : goldPct > 0 ? `+${goldPct}% Gold` : `${goldPct}% Gold`;
    const relStr = rel === 0 ? '' : rel > 0 ? ` · Rel +${rel}/yr` : ` · Rel ${rel}/yr`;
    const corrStr = corr > 0 ? ` · +${corr} Corruption` : '';
    return `${goldStr}${relStr}${corrStr}`;
  }

  function securitySummary(val: SecurityNotch): string {
    const base = SECURITY_IMPERIUM_BASE[val];
    const imp = base === 0 ? 'No Imperium' : `+${Math.round(base * (1 + governorMartial / 100))} Imperium`;
    const revolt = SECURITY_REVOLT_DELTA[val];
    const revStr = revolt === 0 ? '' : revolt > 0 ? ` · Revolt +${Math.round(revolt * 100)}%` : ` · Revolt ${Math.round(revolt * 100)}%`;
    return `${imp}${revStr}`;
  }

  function developmentSummary(val: DevelopmentNotch): string {
    const infra = DEVELOPMENT_INFRA_DELTA[val];
    const rel = DEVELOPMENT_REL_PER_YEAR[val];
    const infraStr = infra === 0 ? 'Stable Infra' : infra > 0 ? `Infra +${infra}/turn` : `Infra ${infra}/turn`;
    const relStr = rel === 0 ? '' : rel > 0 ? ` · Rel +${rel}/yr` : ` · Rel ${rel}/yr`;
    return `${infraStr}${relStr}`;
  }

  return (
    <View style={styles.board}>
      {readOnly && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>
            NPC GOVERNOR — {readOnly ? 'intelligence required to view full policy' : ''}
          </Text>
        </View>
      )}

      <InfoTap termId="governor-policy" style={styles.policyHeader}>
        <Text style={styles.policyHeaderText}>GOVERNOR POLICY</Text>
      </InfoTap>

      <AxisSlider
        label="Taxation"
        notches={TAXATION_NOTCHES}
        labels={TAXATION_LABELS}
        current={policy.taxation}
        onChange={(val) => onPolicyChange({ ...policy, taxation: val })}
        renderSummary={taxationSummary}
        disabled={readOnly}
      />

      <View style={styles.divider} />

      <AxisSlider
        label="Security"
        notches={SECURITY_NOTCHES}
        labels={SECURITY_LABELS}
        current={policy.security}
        onChange={(val) => onPolicyChange({ ...policy, security: val })}
        renderSummary={securitySummary}
        disabled={readOnly}
      />

      <View style={styles.divider} />

      <AxisSlider
        label="Development"
        notches={DEVELOPMENT_NOTCHES}
        labels={DEVELOPMENT_LABELS}
        current={policy.development}
        onChange={(val) => onPolicyChange({ ...policy, development: val })}
        renderSummary={developmentSummary}
        disabled={readOnly}
      />

      {!readOnly && (
        <Text style={styles.hint}>
          Policy is set once per season. Changes take effect next season end.
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    padding: SPACING.md,
  } as ViewStyle,

  policyHeader: {
    marginBottom: SPACING.sm,
  } as ViewStyle,

  policyHeaderText: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  } as TextStyle,

  readOnlyBanner: {
    backgroundColor: '#2a2018',
    borderRadius: 4,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  readOnlyText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
  } as TextStyle,

  axisContainer: {
    marginBottom: SPACING.sm,
  } as ViewStyle,

  axisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  } as ViewStyle,

  axisLabel: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  } as TextStyle,

  axisSummary: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    flex: 1,
    textAlign: 'right',
    marginLeft: SPACING.sm,
  } as TextStyle,

  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
  } as ViewStyle,

  notchWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    paddingTop: 10,
  } as ViewStyle,

  trackLine: {
    position: 'absolute',
    top: 10 + 6, // centre of notch circle
    left: '50%',
    right: '-50%',
    height: 2,
    zIndex: 0,
  } as ViewStyle,

  trackLineActive: {
    backgroundColor: COLORS.gold,
  } as ViewStyle,

  trackLineInactive: {
    backgroundColor: COLORS.border,
  } as ViewStyle,

  notchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    borderWidth: 1.5,
    borderColor: '#5a4a30',
    zIndex: 1,
  } as ViewStyle,

  notchCircleActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: -1,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  } as ViewStyle,

  notchCirclePassed: {
    backgroundColor: '#7a6230',
    borderColor: COLORS.goldDim,
  } as ViewStyle,

  notchCircleDisabled: {
    opacity: 0.5,
  } as ViewStyle,

  notchLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 11,
  } as TextStyle,

  notchLabelActive: {
    color: COLORS.gold,
    fontWeight: '700',
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  } as ViewStyle,

  hint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.7,
  } as TextStyle,
});
