// src/components/provinciae/MilitaryTab.tsx
// Renders inside ProvinceSheet's MILITARY tab.
// Shows: active campaign War Room, pending commander election, officer volunteer
// option, revolt status, and campaign history.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type {
  ProvinceState,
  CampaignState,
  CommanderElectionState,
  OfficerVolunteerState,
  GovernorCandidate,
} from '../../models/province';
import type { Character } from '../../models/character';
import { getCampaignEventDef } from '../../data/campaignEvents';
import type { CampaignAllocation } from '../../engine/campaignEngine';
import { getOfficerDecisions } from '../../engine/campaignEngine';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MilitaryTabProps {
  province: ProvinceState;
  family: Character[];
  playerGravitas: number;
  playerDenarii: number;
  playerImperium: number;
  commanderElection: CommanderElectionState | null;
  officerVolunteer: OfficerVolunteerState | null;
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;

  onStartCampaign: (provinceId: string, type: CampaignState['type']) => void;
  onCommitCampaignSeason: (provinceId: string, allocation: CampaignAllocation) => void;
  onResolveCampaignEvent: (provinceId: string, eventId: string, optionId: string) => void;
  onNominateCommander: (provinceId: string, candidateId: string) => void;
  onVoteCommander: (leaderId: string, vote: 'for' | 'against') => void;
  onSpeechCommander: (provinceId: string) => void;
  onVolunteerOfficer: (provinceId: string, characterId: string) => void;
  onResolveOfficerDecision: (provinceId: string, decisionIndex: number, tookRisk: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MilitaryTab({
  province,
  family,
  playerGravitas,
  playerDenarii,
  playerImperium,
  commanderElection,
  officerVolunteer,
  campaignVotes,
  onStartCampaign,
  onCommitCampaignSeason,
  onResolveCampaignEvent,
  onNominateCommander,
  onVoteCommander,
  onSpeechCommander,
  onVolunteerOfficer,
  onResolveOfficerDecision,
}: MilitaryTabProps) {
  const campaign = province.activeCampaign;
  const [manpower, setManpower] = useState<CampaignAllocation['manpower']>('standard');
  const [strategy, setStrategy] = useState<CampaignAllocation['strategy']>('probe');
  const [morale, setMorale] = useState<CampaignAllocation['morale']>('pay');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(null);

  // The player family member currently serving as governor of this province (if any)
  const playerGovernorChar = province.playerGovernor?.characterId
    ? family.find(c => c.id === province.playerGovernor!.characterId) ?? null
    : null;

  // ── No military activity ───────────────────────────────────────────────────
  if (!campaign && !commanderElection && !officerVolunteer && !province.revoltActive) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🕊</Text>
        <Text style={styles.emptyTitle}>No Active Campaign</Text>
        <Text style={styles.emptyDesc}>
          {province.relationshipScore <= 15
            ? 'This province is Hostile. A campaign may be necessary to restore order.'
            : 'This province is at peace. Military action can be triggered via Curia war declaration bills.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Revolt Warning ────────────────────────────────────────────────── */}
      {province.revoltActive && !campaign && (
        <View style={styles.revoltBanner}>
          <Text style={styles.revoltBannerTitle}>⚔ REVOLT IN PROGRESS</Text>
          <Text style={styles.revoltBannerDesc}>
            This province is in open revolt. Until suppressed, it produces no income
            and its Relationship continues to deteriorate.
          </Text>

          {playerGovernorChar ? (
            // ── Path A: player family member is governor → lead as commander ──
            <TouchableOpacity
              style={styles.suppressionBtn}
              onPress={() => onStartCampaign(province.id, 'suppression')}
              activeOpacity={0.75}
            >
              <Text style={styles.suppressionBtnText}>
                ⚔ Lead Suppression — {playerGovernorChar.name} commands
              </Text>
            </TouchableOpacity>
          ) : (
            // ── Path B: no player governor → volunteer a family member as captain ──
            <>
              <Text style={styles.captainPrompt}>
                Your family holds no governorship here. Volunteer a family member as captain
                under the Senate's appointed commander:
              </Text>
              {family.map(char => (
                <TouchableOpacity
                  key={char.id}
                  style={[
                    styles.volunteerCard,
                    selectedVolunteerId === char.id && styles.volunteerCardSelected,
                  ]}
                  onPress={() => setSelectedVolunteerId(char.id)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={styles.volunteerName}>{char.name}</Text>
                    <Text style={styles.volunteerStats}>
                      Martial {char.skills.martial}/10 · Age {char.age}
                    </Text>
                  </View>
                  {selectedVolunteerId === char.id && (
                    <Text style={styles.volunteerTick}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.suppressionBtn, !selectedVolunteerId && styles.btnDisabled]}
                onPress={() => {
                  if (selectedVolunteerId) {
                    onStartCampaign(province.id, 'suppression');
                    onVolunteerOfficer(province.id, selectedVolunteerId);
                  }
                }}
                disabled={!selectedVolunteerId}
                activeOpacity={0.75}
              >
                <Text style={[styles.suppressionBtnText, !selectedVolunteerId && { opacity: 0.5 }]}>
                  ⚔ Volunteer as Captain
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ── Commander Election ────────────────────────────────────────────── */}
      {commanderElection && !commanderElection.resolved && (
        <CommanderElectionPanel
          election={commanderElection}
          campaignVotes={campaignVotes}
          playerGravitas={playerGravitas}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={setSelectedCandidateId}
          onNominate={() => {
            if (selectedCandidateId) {
              onNominateCommander(province.id, selectedCandidateId);
            }
          }}
          onVote={(leaderId, vote) => onVoteCommander(leaderId, vote)}
          onSpeech={() => onSpeechCommander(province.id)}
        />
      )}

      {/* ── Active Campaign — Commander (Medium System) ───────────────────── */}
      {campaign && campaign.commanderCharacterId && !campaign.resolved && (
        <WarRoom
          campaign={campaign}
          family={family}
          manpower={manpower}
          strategy={strategy}
          morale={morale}
          playerDenarii={playerDenarii}
          playerGravitas={playerGravitas}
          onSetManpower={setManpower}
          onSetStrategy={setStrategy}
          onSetMorale={setMorale}
          onCommit={() => onCommitCampaignSeason(province.id, { manpower, strategy, morale })}
          onResolveEvent={(eventId, optionId) =>
            onResolveCampaignEvent(province.id, eventId, optionId)
          }
        />
      )}

      {/* ── Officer decisions resolved — waiting for season end ───────────── */}
      {officerVolunteer?.resolved && campaign && !campaign.resolved && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚔ SUPPRESSION IN PROGRESS</Text>
          <Text style={styles.commanderName}>
            {officerVolunteer.characterName} · Officer assignment complete
          </Text>
          <Text style={styles.sectionDesc}>
            All decisions made. Successes: {officerVolunteer.successCount}/3.
          </Text>
          <Text style={styles.electionHint}>
            {officerVolunteer.successCount >= 2
              ? 'Your officer performed well. The campaign will conclude at the end of the season.'
              : officerVolunteer.successCount === 1
              ? 'A mixed performance. The campaign outcome is uncertain.'
              : 'Your officer struggled. The suppression may fail.'}
          </Text>
        </View>
      )}

      {/* ── Officer Volunteer (Light System) ──────────────────────────────── */}
      {officerVolunteer && !officerVolunteer.resolved && (
        <OfficerPanel
          volunteer={officerVolunteer}
          family={family}
          onResolveDecision={(idx, risk) =>
            onResolveOfficerDecision(province.id, idx, risk)
          }
        />
      )}

      {/* ── No officer yet — offer to volunteer ───────────────────────────── */}
      {campaign && !officerVolunteer && campaign.commanderCharacterId !== null && (        <VolunteerSection
          family={family}
          onVolunteer={(charId) => onVolunteerOfficer(province.id, charId)}
        />
      )}

      {/* ── Campaign resolved ─────────────────────────────────────────────── */}
      {campaign && campaign.resolved && (
        <View style={styles.resolvedCard}>
          <Text style={styles.resolvedTitle}>Campaign Concluded</Text>
          <Text style={styles.resolvedOutcome}>
            {outcomeLabel(campaign.outcome)}
          </Text>
        </View>
      )}

    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommanderElectionPanel({
  election,
  campaignVotes,
  playerGravitas,
  selectedCandidateId,
  onSelectCandidate,
  onNominate,
  onVote,
  onSpeech,
}: {
  election: CommanderElectionState;
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;
  playerGravitas: number;
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  onNominate: () => void;
  onVote: (leaderId: string, vote: 'for' | 'against') => void;
  onSpeech: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚖ COMMANDER ELECTION</Text>
      <Text style={styles.sectionDesc}>
        The Senate must vote on who commands the {election.provinceId.replace('_', ' ')} campaign.
        Support your preferred candidate with speeches and canvassing.
      </Text>

      {/* Candidate list */}
      {election.candidates.map(candidate => (
        <TouchableOpacity
          key={candidate.characterId}
          style={[
            styles.candidateCard,
            selectedCandidateId === candidate.characterId && styles.candidateCardSelected,
          ]}
          onPress={() => onSelectCandidate(candidate.characterId)}
          activeOpacity={0.75}
        >
          <View style={styles.candidateRow}>
            <Text style={styles.candidateName}>
              {candidate.isPlayerFamily ? '⭐ ' : ''}{candidate.characterName}
            </Text>
            <Text style={styles.candidateClan}>{candidate.clanName}</Text>
          </View>
          <Text style={styles.candidateStats}>
            Martial {candidate.martialSkill}/10
          </Text>
        </TouchableOpacity>
      ))}

      {/* Action buttons */}
      <View style={styles.electionActions}>
        <TouchableOpacity
          style={[styles.electionBtn, !selectedCandidateId && styles.btnDisabled]}
          onPress={onNominate}
          disabled={!selectedCandidateId}
          activeOpacity={0.75}
        >
          <Text style={styles.electionBtnText}>Support Candidate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.electionBtn, playerGravitas < 10 && styles.btnDisabled]}
          onPress={onSpeech}
          disabled={playerGravitas < 10}
          activeOpacity={0.75}
        >
          <Text style={styles.electionBtnText}>Give Speech (10 Gravitas)</Text>
        </TouchableOpacity>
      </View>

      {/* Family nomination — shown when no family member is yet in the candidate list */}
      {!election.candidates.some(c => c.isPlayerFamily) && (
        <FamilyNominationSection
          election={election}
          onSelectCandidate={onSelectCandidate}
        />
      )}

      <Text style={styles.electionHint}>
        Also use Forum → Canvass for Votes to build support for your preferred commander.
        Senate votes at end of season.
      </Text>
    </View>
  );
}

function FamilyNominationSection({
  election,
  onSelectCandidate,
}: {
  election: CommanderElectionState;
  onSelectCandidate: (id: string) => void;
}) {
  // This panel is only shown if generateCommanderCandidates returned no family members
  // (edge case: all family members are currently in office). Shouldn't normally appear
  // since the fixed generateCommanderCandidates always appends family candidates,
  // but kept as a fallback UI safety net.
  return (
    <View style={styles.familyNomBox}>
      <Text style={styles.familyNomTitle}>No family candidate in the running</Text>
      <Text style={styles.familyNomDesc}>
        None of your family members appear among the Senate's candidates.
        You may still support an NPC candidate above, or use Forum → Canvass for Votes
        to shift senate opinion toward them.
      </Text>
    </View>
  );
}

function WarRoom({
  campaign,
  family,
  manpower,
  strategy,
  morale,
  playerDenarii,
  playerGravitas,
  onSetManpower,
  onSetStrategy,
  onSetMorale,
  onCommit,
  onResolveEvent,
}: {
  campaign: CampaignState;
  family: Character[];
  manpower: CampaignAllocation['manpower'];
  strategy: CampaignAllocation['strategy'];
  morale: CampaignAllocation['morale'];
  playerDenarii: number;
  playerGravitas: number;
  onSetManpower: (v: CampaignAllocation['manpower']) => void;
  onSetStrategy: (v: CampaignAllocation['strategy']) => void;
  onSetMorale: (v: CampaignAllocation['morale']) => void;
  onCommit: () => void;
  onResolveEvent: (eventId: string, optionId: string) => void;
}) {
  const commander = family.find(c => c.id === campaign.commanderCharacterId);
  const eventDef = campaign.activeEventId ? getCampaignEventDef(campaign.activeEventId) : null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚔ WAR ROOM</Text>

      {/* Commander info */}
      <View style={styles.commanderBadge}>
        <Text style={styles.commanderLabel}>COMMANDER</Text>
        <Text style={styles.commanderName}>
          {commander?.name ?? 'Unknown'} · Martial {commander?.skills.martial ?? 0}/10
        </Text>
        <Text style={styles.campaignType}>{campaignTypeLabel(campaign.type)}</Text>
      </View>

      {/* Progress bars */}
      <View style={styles.barsRow}>
        <ProgressBar
          label="Campaign Progress"
          value={campaign.campaignProgress}
          color={COLORS.laurel}
        />
        <ProgressBar
          label="Enemy Strength"
          value={campaign.enemyStrength}
          color={COLORS.crimson}
        />
      </View>

      {/* Active event card */}
      {eventDef && (
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>📜 {eventDef.title}</Text>
          <Text style={styles.eventDesc}>{eventDef.description}</Text>
          {eventDef.options.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={styles.eventOption}
              onPress={() => onResolveEvent(eventDef.id, opt.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.eventOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Allocation decisions */}
      {!eventDef && (
        <>
          <AllocationRow
            label="MANPOWER"
            options={[
              { id: 'press',    label: 'Press (free)' },
              { id: 'standard', label: 'Levy (20g)' },
              { id: 'elite',    label: 'Elite (50g)' },
            ]}
            selected={manpower}
            onSelect={(v) => onSetManpower(v as CampaignAllocation['manpower'])}
          />
          <AllocationRow
            label="STRATEGY"
            options={[
              { id: 'advance',  label: 'Advance' },
              { id: 'probe',    label: 'Probe' },
              { id: 'fortify',  label: 'Fortify' },
            ]}
            selected={strategy}
            onSelect={(v) => onSetStrategy(v as CampaignAllocation['strategy'])}
          />
          <AllocationRow
            label="MORALE"
            options={[
              { id: 'pay',   label: 'Pay (30g)' },
              { id: 'rally', label: 'Rally (10 Grav)' },
              { id: 'loot',  label: 'Let Loot' },
            ]}
            selected={morale}
            onSelect={(v) => onSetMorale(v as CampaignAllocation['morale'])}
          />

          <TouchableOpacity style={styles.commitBtn} onPress={onCommit} activeOpacity={0.75}>
            <Text style={styles.commitBtnText}>COMMIT SEASON</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.turnCounter}>Season {campaign.turnsElapsed + 1}</Text>
    </View>
  );
}

function OfficerPanel({
  volunteer,
  family,
  onResolveDecision,
}: {
  volunteer: OfficerVolunteerState;
  family: Character[];
  onResolveDecision: (index: number, tookRisk: boolean) => void;
}) {
  const decisions = getOfficerDecisions();
  const currentDecisionIndex = volunteer.decisionsResolved;
  const decision = currentDecisionIndex < 3 ? decisions[currentDecisionIndex] : null;
  const officer = family.find(c => c.id === volunteer.characterId);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🛡 OFFICER ASSIGNMENT</Text>
      <Text style={styles.commanderName}>
        {officer?.name ?? volunteer.characterName} · Decision {currentDecisionIndex + 1}/3
      </Text>

      {decision && (
        <View style={styles.officerDecision}>
          <Text style={styles.officerPrompt}>{decision.prompt}</Text>
          <TouchableOpacity
            style={[styles.officerOption, styles.officerRisk]}
            onPress={() => onResolveDecision(currentDecisionIndex, true)}
            activeOpacity={0.75}
          >
            <Text style={styles.officerOptionText}>{decision.riskOption}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.officerOption, styles.officerSafe]}
            onPress={() => onResolveDecision(currentDecisionIndex, false)}
            activeOpacity={0.75}
          >
            <Text style={styles.officerOptionText}>{decision.safeOption}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.officerProgress}>
        Successes: {volunteer.successCount}/{volunteer.decisionsResolved}
      </Text>
    </View>
  );
}

function VolunteerSection({
  family,
  onVolunteer,
}: {
  family: Character[];
  onVolunteer: (characterId: string) => void;
}) {
  const eligible = family.filter(c => c.age >= 18 && !c.officeId);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🛡 VOLUNTEER AS OFFICER</Text>
      <Text style={styles.sectionDesc}>
        Send a family member to serve under the campaign commander. They will face
        3 decision points and return with Martial experience and potentially a veteran trait.
      </Text>
      {eligible.map(char => (
        <TouchableOpacity
          key={char.id}
          style={styles.volunteerCard}
          onPress={() => onVolunteer(char.id)}
          activeOpacity={0.75}
        >
          <Text style={styles.volunteerName}>{char.name}</Text>
          <Text style={styles.volunteerStats}>
            Age {char.age} · Martial {char.skills.martial}/10
          </Text>
        </TouchableOpacity>
      ))}
      {eligible.length === 0 && (
        <Text style={styles.emptyDesc}>No eligible family members available.</Text>
      )}
    </View>
  );
}

function ProgressBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.progressBarWrap}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={styles.progressBarValue}>{value}/100</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function AllocationRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.allocationRow}>
      <Text style={styles.allocationLabel}>{label}</Text>
      <View style={styles.allocationOptions}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.allocationBtn,
              selected === opt.id && styles.allocationBtnSelected,
            ]}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.allocationBtnText,
                selected === opt.id && styles.allocationBtnTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function campaignTypeLabel(type: CampaignState['type']): string {
  const labels: Record<CampaignState['type'], string> = {
    conquest:       'Conquest Campaign',
    defence:        'Defensive War',
    suppression:    'Revolt Suppression',
    allied_support: 'Allied Support',
  };
  return labels[type];
}

function outcomeLabel(outcome: CampaignState['outcome']): string {
  if (!outcome) return 'Unknown';
  const labels: Record<NonNullable<CampaignState['outcome']>, string> = {
    victory:       '⚔ Victory — Enemy destroyed',
    strategic_win: '⚔ Strategic victory — Objectives secured',
    stalemate:     '⚔ Stalemate — No decision reached',
    defeat:        '⚔ Defeat — Forces routed',
  };
  return labels[outcome];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.marble,
    marginBottom: SPACING.sm,
  },
  emptyDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.dust,
    textAlign: 'center',
    lineHeight: 18,
  },
  revoltAlert: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.crimson + '33',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  revoltText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.crimson,
    textAlign: 'center',
  },
  revoltBanner: {
    backgroundColor: COLORS.crimson + '22',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.crimson,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
  },
  revoltBannerTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.crimson,
    marginBottom: 4,
  },
  revoltBannerDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  captainPrompt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
    lineHeight: 17,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  suppressionBtn: {
    backgroundColor: COLORS.crimson,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  suppressionBtnText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.marble,
    letterSpacing: 0.5,
  },
  volunteerTick: {
    fontFamily: FONTS.ui,
    fontSize: 16,
    color: COLORS.gold,
  },
  section: {
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  sectionDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  // Commander election
  candidateCard: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  candidateCardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '15',
  },
  candidateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  candidateName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.marble,
    fontWeight: '600',
  },
  candidateClan: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
  },
  candidateStats: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.goldDim,
  },
  electionActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  electionBtn: {
    flex: 1,
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  electionBtnText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
  },
  electionHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: SPACING.sm,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  familyNomBox: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderStyle: 'dashed',
  },
  familyNomTitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.goldDim,
    fontWeight: '600',
    marginBottom: 3,
  },
  familyNomDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
    lineHeight: 16,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  // War Room
  commanderBadge: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  commanderLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.goldDim,
    letterSpacing: 1,
  },
  commanderName: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
  },
  campaignType: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
    marginTop: 2,
  },
  barsRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressBarWrap: {
    marginBottom: SPACING.xs,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressBarLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
  },
  progressBarValue: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.marble,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Event card
  eventCard: {
    backgroundColor: COLORS.parchment + '18',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  eventTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.gold,
    marginBottom: 4,
  },
  eventDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  eventOption: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventOptionText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.marble,
  },
  // Allocation rows
  allocationRow: {
    marginBottom: SPACING.sm,
  },
  allocationLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.goldDim,
    letterSpacing: 1,
    marginBottom: 4,
  },
  allocationOptions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  allocationBtn: {
    flex: 1,
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  allocationBtnSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '20',
  },
  allocationBtnText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
  },
  allocationBtnTextSelected: {
    color: COLORS.gold,
    fontWeight: '600',
  },
  commitBtn: {
    backgroundColor: COLORS.crimson,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  commitBtnText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
    letterSpacing: 1,
  },
  turnCounter: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  // Officer panel
  officerDecision: {
    marginTop: SPACING.sm,
  },
  officerPrompt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.marble,
    lineHeight: 18,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  officerOption: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
  },
  officerRisk: {
    backgroundColor: COLORS.crimson + '18',
    borderColor: COLORS.crimson,
  },
  officerSafe: {
    backgroundColor: COLORS.panelElevated,
    borderColor: COLORS.border,
  },
  officerOptionText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.marble,
  },
  officerProgress: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: SPACING.sm,
  },
  // Volunteer section
  volunteerCard: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volunteerCardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '18',
  },
  volunteerName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.marble,
    fontWeight: '600',
  },
  volunteerStats: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.dust,
  },
  // Resolved state
  resolvedCard: {
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  resolvedTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.goldDim,
    marginBottom: SPACING.xs,
  },
  resolvedOutcome: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.marble,
    textAlign: 'center',
  },
});
