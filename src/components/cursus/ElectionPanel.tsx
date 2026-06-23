import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { OFFICES } from '../../data/offices';

export default function ElectionPanel() {
  const {
    campaigning,
    currentOffice,
    heldOffices,
    electionRivals,
    campaignVotes,
    clans,
    clients,
    declareCampaign,
    canvassForVotes,
    cursusLog,
  } = useGameStore();

  // Voting Sway client count for modifier row
  const votingSwayCount = clients.filter(c => c.type === 'votingSway').length;

  const eligibleOffices = OFFICES.filter(
    o => !heldOffices.includes(o.id) && o.id !== currentOffice && o.id !== campaigning
  );

  const allLeaders = clans.flatMap(c =>
    c.leaders.map(l => ({ ...l, clanName: c.name, clanId: c.id }))
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

      {/* Current office */}
      {currentOffice && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>CURRENT OFFICE</Text>
          <Text style={styles.officeName}>
            {OFFICES.find(o => o.id === currentOffice)?.name ?? currentOffice}
          </Text>
        </View>
      )}

      {/* Campaign status */}
      {campaigning ? (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>CAMPAIGN IN PROGRESS</Text>
          <Text style={styles.officeName}>
            {OFFICES.find(o => o.id === campaigning)?.name ?? campaigning}
          </Text>

          {/* Modifier rows */}
          <View style={styles.modifiersBlock}>
            <Text style={styles.modifiersHeading}>MODIFIERS</Text>

            {/* Voting Sway client modifier row */}
            {votingSwayCount > 0 && (
              <View style={styles.modifierRow}>
                <Text style={styles.modifierLabel}>
                  🗳️ {votingSwayCount} Voting Sway client{votingSwayCount !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.modifierValue, { color: COLORS.laurel }]}>
                  +{votingSwayCount} votes
                </Text>
              </View>
            )}
          </View>

          {/* Canvass leaders */}
          <Text style={styles.subLabel}>CANVASS LEADERS</Text>
          {allLeaders.map(leader => {
            const vote = campaignVotes[leader.id];
            return (
              <TouchableOpacity
                key={leader.id}
                style={[
                  styles.leaderRow,
                  vote && styles.leaderRowCanvassed,
                ]}
                onPress={() => canvassForVotes(leader.id)}
                disabled={!!vote}
                activeOpacity={0.75}
              >
                <Text style={styles.leaderName}>
                  {leader.emoji ?? '👤'} {leader.name}
                </Text>
                <Text style={styles.leaderClan}>{leader.clanName}</Text>
                {vote ? (
                  <Text style={[
                    styles.voteResult,
                    vote === 'for' ? styles.voteFor : vote === 'against' ? styles.voteAgainst : styles.voteNeutral,
                  ]}>
                    {vote.toUpperCase()}
                  </Text>
                ) : (
                  <Text style={styles.canvassHint}>−6 Gratia</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Rivals */}
          {electionRivals.length > 0 && (
            <>
              <Text style={[styles.subLabel, { marginTop: SPACING.md }]}>RIVALS</Text>
              {electionRivals.map(rival => (
                <View key={rival.id} style={styles.rivalRow}>
                  <Text style={styles.rivalName}>{rival.emoji ?? '⚔️'} {rival.name}</Text>
                  <Text style={styles.rivalStrength}>Strength {rival.strength}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      ) : (
        /* Declare campaign */
        eligibleOffices.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.sectionLabel}>DECLARE CAMPAIGN</Text>
            {eligibleOffices.map(office => (
              <TouchableOpacity
                key={office.id}
                style={styles.officeBtn}
                onPress={() => declareCampaign(office.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.officeBtnName}>{office.name}</Text>
                <Text style={styles.officeBtnDesc}>{office.description ?? ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      )}

      {/* Held offices */}
      {heldOffices.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>HELD OFFICES</Text>
          {heldOffices.map(id => (
            <Text key={id} style={styles.heldOffice}>
              ✓ {OFFICES.find(o => o.id === id)?.name ?? id}
            </Text>
          ))}
        </View>
      )}

      {/* Cursus log */}
      {cursusLog.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>CURSUS LOG</Text>
          {[...cursusLog].reverse().slice(0, 8).map(entry => (
            <Text key={entry.id} style={styles.logEntry}>
              {entry.turn} — {entry.text}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  panel: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  officeName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Modifier rows ──────────────────────────────────────────────────────────
  modifiersBlock: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  modifiersHeading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  modifierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  modifierLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    flex: 1,
  },
  modifierValue: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Leader canvass rows ────────────────────────────────────────────────────
  subLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  leaderRowCanvassed: {
    opacity: 0.6,
  },
  leaderName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    flex: 1,
  },
  leaderClan: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  voteResult: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  voteFor: {
    color: COLORS.laurel,
  },
  voteAgainst: {
    color: COLORS.crimson,
  },
  voteNeutral: {
    color: COLORS.dust,
  },
  canvassHint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },

  // ── Rival rows ─────────────────────────────────────────────────────────────
  rivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rivalName: {
    color: COLORS.crimson,
    fontFamily: FONTS.display,
    fontSize: 13,
  },
  rivalStrength: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },

  // ── Office buttons ─────────────────────────────────────────────────────────
  officeBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  officeBtnName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
  },
  officeBtnDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 2,
  },

  // ── Held offices / log ─────────────────────────────────────────────────────
  heldOffice: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 13,
    marginBottom: 2,
  },
  logEntry: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginBottom: 3,
  },
});
