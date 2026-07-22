import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import type {
  CityState,
  GovernorPolicy,
  CampaignState,
  CommanderElectionState,
  OfficerVolunteerState,
} from '../../models/city';
import { getRelationshipLabel, getRelationshipTier } from '../../models/city';
import { getCityDefinition } from '../../data/cityDefinitions';
import PolicyBoard from './PolicyBoard';
import DiplomatDesk from './DiplomatDesk';
import HoldingsPanel from './HoldingsPanel';
import CityClientCard from './CityClientCard';
import MilitaryTab from './MilitaryTab';
import MusterPickerModal from './MusterPickerModal';
import type { AmbassadorActionId } from '../../engine/cityEngine';
import { getIncorporationBillName, getDeclareWarBillName } from '../../engine/cityEngine';
import type { Character } from '../../models/character';
import type { TroopUnit } from '../../models/troop';
import type { Bill } from '../../models/bill';
import type { CampaignAllocation } from '../../engine/campaignEngine';
import { calcTotalImperium } from '../../engine/troopEngine';
import { useGameStore } from '../../state/gameStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetTab = 'overview' | 'policy' | 'assets' | 'clients' | 'military';

interface CitySheetProps {
  province: CityState;
  family: Character[];
  playerFides: number;
  playerDenarii: number;
  playerImperium: number;
  playerGoverningMartial: number;
  recruitedClientIds: string[];
  commanderElection: CommanderElectionState | null;
  officerVolunteer: OfficerVolunteerState | null;
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;
  bills: Bill[];
  onClose: () => void;
  onPolicyChange: (provinceId: string, policy: GovernorPolicy) => void;
  onAmbassadorAction: (provinceId: string, actionId: AmbassadorActionId) => void;
  onRecruitClient: (provinceId: string, clientId: string) => void;
  onSeekPosting: (provinceId: string) => void;
  onProposeIncorporation: (provinceId: string) => void;
  onProposeDeclareWar: (provinceId: string) => void;
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

export default function CitySheet({
  province,
  family,
  playerFides,
  playerDenarii,
  playerImperium,
  playerGoverningMartial,
  recruitedClientIds,
  commanderElection,
  officerVolunteer,
  campaignVotes,
  bills,
  onClose,
  onPolicyChange,
  onAmbassadorAction,
  onRecruitClient,
  onSeekPosting,
  onProposeIncorporation,
  onProposeDeclareWar,
  onStartCampaign,
  onCommitCampaignSeason,
  onResolveCampaignEvent,
  onNominateCommander,
  onVoteCommander,
  onSpeechCommander,
  onVolunteerOfficer,
  onResolveOfficerDecision,
}: CitySheetProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const [musterPickerVisible, setMusterPickerVisible] = useState(false);
  const def = getCityDefinition(province.id);
  if (!def) return null;

  const isHeartland = def.status === 'heartland';
  const isForeign = province.status === 'foreign';
  const hasPlayerGovernor = !!province.playerGovernor;
  const hasPlayerAmbassador = !!province.playerAmbassador;
  const relationshipTier = getRelationshipTier(province.relationshipScore);
  const incorporationBillPending = bills.some(b => b.name === getIncorporationBillName(def));
  const declareWarEligible = isForeign && !def.clientOf && relationshipTier === 'hostile';
  const declareWarBillPending = bills.some(b => b.name === getDeclareWarBillName(def));
  // Fuzzy-matched rather than exact name (unlike the incorporation/declare-war bills) since
  // the ambassador bill's name also embeds the requesting character, which CitySheet
  // doesn't otherwise resolve — this just checks "is any posting bill already pending for
  // this city," regardless of which family member it's for.
  const ambassadorBillPending = bills.some(b => b.name.startsWith('Ambassador Posting:') && b.name.endsWith(` to ${def.name}`));

  // Military section: find the relevant player character for this city.
  // Prefer the active governor; fall back to any family member with troops here.
  // @ts-ignore — musterVeterans added in Chunk M
  const musterVeterans = useGameStore(s => s.musterVeterans);
  const governorCharId = province.playerGovernor?.characterId;
  const militaryCharacter: Character | null =
    (governorCharId ? family.find(c => c.id === governorCharId) : null)
    ?? family.find(c => c.raisedLegions?.some((t: TroopUnit) => t.musterProvinceId === province.id))
    ?? null;
  const showMilitarySection = !!militaryCharacter;

  // Military tab badge — show dot if active campaign or pending election
  const hasMilitaryActivity =
    !!province.activeCampaign ||
    !!commanderElection ||
    !!officerVolunteer ||
    province.revoltActive;

  // Tab 2 label adapts to context
  const policyTabLabel = hasPlayerGovernor
    ? 'POLICY'
    : hasPlayerAmbassador
    ? 'DIPLOMAT'
    : 'INTEL';

  const tabs: { id: SheetTab; label: string; badge?: boolean }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'policy', label: policyTabLabel },
    { id: 'assets', label: 'ASSETS' },
    { id: 'clients', label: 'CLIENTS' },
    { id: 'military', label: 'MILITARY', badge: hasMilitaryActivity },
  ];

  return (
    <View style={styles.sheet}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.provinceName}>{def.name.toUpperCase()}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColour(province, province.status) }]} />
            <Text style={styles.statusLabel}>
              {isHeartland
                ? 'Heartland — Rome Itself'
                : isForeign
                ? getForeignLabel(def, province)
                : def.status === 'incorporated' ? 'Incorporated Province' : 'Unincorporated Territory'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tab strip */}
      {!isHeartland && !isForeign && (
        <View style={styles.tabStrip}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {tab.badge && <View style={styles.tabBadge} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentInner}
      >
        {isHeartland ? (
          <HeartlandView def={def} />
        ) : isForeign ? (
          <ForeignTerritoryView
            def={def}
            province={province}
            declareWarEligible={declareWarEligible}
            declareWarBillPending={declareWarBillPending}
            ambassadorBillPending={ambassadorBillPending}
            onProposeDeclareWar={() => onProposeDeclareWar(province.id)}
            onSeekPosting={() => onSeekPosting(province.id)}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                province={province}
                def={def}
                hasPlayerGovernor={hasPlayerGovernor}
                hasPlayerAmbassador={hasPlayerAmbassador}
                playerFides={playerFides}
                incorporationBillPending={incorporationBillPending}
                ambassadorBillPending={ambassadorBillPending}
                onSeekPosting={() => onSeekPosting(province.id)}
                onProposeIncorporation={() => onProposeIncorporation(province.id)}
              />
            )}
            {activeTab === 'policy' && (
              <PolicyTab
                province={province}
                def={def}
                hasPlayerGovernor={hasPlayerGovernor}
                hasPlayerAmbassador={hasPlayerAmbassador}
                playerFides={playerFides}
                playerDenarii={playerDenarii}
                governorMartial={playerGoverningMartial}
                onPolicyChange={(policy) => onPolicyChange(province.id, policy)}
                onAmbassadorAction={(actionId) => onAmbassadorAction(province.id, actionId)}
              />
            )}
            {activeTab === 'assets' && (
              <HoldingsPanel locationId={province.id} />
            )}
            {activeTab === 'clients' && (
              <CityClientCard
                province={province}
                recruitedClientIds={recruitedClientIds}
                onRecruit={(clientId) => onRecruitClient(province.id, clientId)}
              />
            )}
            {activeTab === 'military' && (
              <>
                <MilitaryTab
                  province={province}
                  family={family}
                  playerFides={playerFides}
                  playerDenarii={playerDenarii}
                  playerImperium={playerImperium}
                  commanderElection={commanderElection}
                  officerVolunteer={officerVolunteer}
                  campaignVotes={campaignVotes}
                  onStartCampaign={(pid, type) => onStartCampaign(pid, type)}
                  onCommitCampaignSeason={(pid, alloc) => onCommitCampaignSeason(pid, alloc)}
                  onResolveCampaignEvent={(pid, eid, oid) => onResolveCampaignEvent(pid, eid, oid)}
                  onNominateCommander={(pid, cid) => onNominateCommander(pid, cid)}
                  onVoteCommander={(lid, vote) => onVoteCommander(lid, vote)}
                  onSpeechCommander={(pid) => onSpeechCommander(pid)}
                  onVolunteerOfficer={(pid, charId) => onVolunteerOfficer(pid, charId)}
                  onResolveOfficerDecision={(pid, idx, risk) => onResolveOfficerDecision(pid, idx, risk)}                />

                {showMilitarySection && militaryCharacter && (
                  <PersonalMilitarySection
                    province={province}
                    character={militaryCharacter}
                    onRaiseLegion={() => setMusterPickerVisible(true)}
                    onMusterVeterans={() => musterVeterans(militaryCharacter.id)}
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Personal legion muster picker */}
      {militaryCharacter && (
        <MusterPickerModal
          visible={musterPickerVisible}
          onClose={() => setMusterPickerVisible(false)}
          characterId={militaryCharacter.id}
        />
      )}
    </View>
  );
}

// ─── Personal Military Section ─────────────────────────────────────────────────

interface PersonalMilitarySectionProps {
  province: CityState;
  character: Character;
  onRaiseLegion: () => void;
  onMusterVeterans: () => void;
}

function PersonalMilitarySection({
  province,
  character,
  onRaiseLegion,
  onMusterVeterans,
}: PersonalMilitarySectionProps) {
  const totalImperium = calcTotalImperium(
    character.formalImperium,
    character.militaryImperium,
  );

  const troopsHere = (character.raisedLegions ?? []).filter(
    (t: TroopUnit) => t.musterProvinceId === province.id,
  );

  const canRaise = totalImperium > 0;
  const hasVeterans = (character.veterans ?? []).length > 0;

  return (
    <View style={milStyles.section}>
      {/* Section heading */}
      <View style={milStyles.sectionHeader}>
        <Text style={milStyles.sectionTitle}>PERSONAL LEGIONS</Text>
      </View>

      {/* Local Support stat bar */}
      <Text style={milStyles.statLabel}>LOCAL SUPPORT</Text>
      <View style={milStyles.barTrack}>
        <View
          style={[
            milStyles.barFill,
            {
              width: `${Math.min(100, province.localSupport)}%` as any,
              backgroundColor: COLORS.gold,
            },
          ]}
        />
      </View>
      <Text style={milStyles.statValue}>{province.localSupport} / 100</Text>

      {/* Stationed troops */}
      {troopsHere.length > 0 ? (
        <>
          <Text style={milStyles.statLabel}>STATIONED TROOPS</Text>
          {troopsHere.map((t: TroopUnit) => (
            <View key={t.id} style={milStyles.troopRow}>
              <Text style={milStyles.troopType}>
                {t.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={milStyles.troopStrength}>STR {t.strength}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={milStyles.noTroopsText}>No legions stationed here.</Text>
      )}

      {/* Raise Legion button */}
      <TouchableOpacity
        style={[milStyles.actionButton, !canRaise && milStyles.actionButtonDisabled]}
        onPress={onRaiseLegion}
        disabled={!canRaise}
        activeOpacity={0.75}
      >
        <Text style={[milStyles.actionButtonText, !canRaise && milStyles.actionButtonTextDisabled]}>
          {canRaise ? '⚔ Raise a Legion' : '⚔ Raise a Legion (requires Imperium)'}
        </Text>
      </TouchableOpacity>

      {/* Muster Veterans button — only if veterans exist */}
      {hasVeterans && (
        <TouchableOpacity
          style={milStyles.actionButton}
          onPress={onMusterVeterans}
          activeOpacity={0.75}
        >
          <Text style={milStyles.actionButtonText}>
            ★ Muster Veterans ({character.veterans.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const milStyles = StyleSheet.create({
  section: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
  } as ViewStyle,

  sectionHeader: {
    marginBottom: SPACING.sm,
  } as ViewStyle,

  sectionTitle: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
  } as TextStyle,

  statLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  } as TextStyle,

  barTrack: {
    height: 6,
    backgroundColor: '#1a1410',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  } as ViewStyle,

  barFill: {
    height: '100%',
    borderRadius: 3,
  } as ViewStyle,

  statValue: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginBottom: SPACING.sm,
  } as TextStyle,

  noTroopsText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  } as TextStyle,

  troopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#1a1814',
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  troopType: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '600',
  } as TextStyle,

  troopStrength: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,

  actionButton: {
    backgroundColor: '#1a3018',
    borderRadius: 6,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    marginTop: SPACING.sm,
  } as ViewStyle,

  actionButtonDisabled: {
    backgroundColor: '#1a1a18',
    borderColor: COLORS.border,
  } as ViewStyle,

  actionButtonText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,

  actionButtonTextDisabled: {
    color: COLORS.dust,
  } as TextStyle,
});

// ─── Sub-views ────────────────────────────────────────────────────────────────

function HeartlandView({ def }: { def: ReturnType<typeof getCityDefinition> }) {
  if (!def) return null;
  return (
    <View style={styles.heartlandView}>
      <Text style={styles.heartlandIcon}>🏛</Text>
      <Text style={styles.heartlandTitle}>{def.latinName}</Text>
      <Text style={styles.heartlandDesc}>{def.flavorDescription}</Text>
    </View>
  );
}

function ForeignTerritoryView({
  def,
  province,
  declareWarEligible,
  declareWarBillPending,
  ambassadorBillPending,
  onProposeDeclareWar,
  onSeekPosting,
}: {
  def: NonNullable<ReturnType<typeof getCityDefinition>>;
  province: CityState;
  declareWarEligible: boolean;
  declareWarBillPending: boolean;
  ambassadorBillPending: boolean;
  onProposeDeclareWar: () => void;
  onSeekPosting: () => void;
}) {
  const relLabel = getRelationshipLabel(province.relationshipScore);
  const relColour = getRelColour(province.relationshipScore);
  return (
    <View style={styles.heartlandView}>
      <Text style={styles.heartlandIcon}>{province.owner === 'carthage' ? '⚓' : '🛡'}</Text>
      <Text style={styles.heartlandTitle}>{def.latinName}</Text>
      <Text style={styles.heartlandDesc}>{def.flavorDescription}</Text>
      <View style={styles.divider} />
      <Text style={[milStyles.statValue, { color: relColour }]}>
        Rome's standing: {relLabel} ({Math.round(province.relationshipScore)})
      </Text>
      {!province.playerAmbassador && (
        <TouchableOpacity
          style={[styles.actionButton, ambassadorBillPending && styles.incorporationBannerDisabled]}
          onPress={onSeekPosting}
          disabled={ambassadorBillPending}
          activeOpacity={0.75}
        >
          <Text style={styles.actionButtonText}>
            {ambassadorBillPending
              ? '✦ Ambassador posting bill already tabled — awaiting the Senate\'s vote'
              : '✦ Request Ambassador Posting'}
          </Text>
        </TouchableOpacity>
      )}
      {declareWarEligible && (
        <TouchableOpacity
          style={[styles.incorporationBanner, declareWarBillPending && styles.incorporationBannerDisabled]}
          onPress={onProposeDeclareWar}
          disabled={declareWarBillPending}
          activeOpacity={0.75}
        >
          <Text style={styles.incorporationText}>
            {declareWarBillPending
              ? '⚔ War bill already tabled — awaiting the Senate\'s vote'
              : `⚔ Declare War on ${def.name} — relations have soured past restraint`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function OverviewTab({
  province,
  def,
  hasPlayerGovernor,
  hasPlayerAmbassador,
  playerFides,
  incorporationBillPending,
  ambassadorBillPending,
  onSeekPosting,
  onProposeIncorporation,
}: {
  province: CityState;
  def: NonNullable<ReturnType<typeof getCityDefinition>>;
  hasPlayerGovernor: boolean;
  hasPlayerAmbassador: boolean;
  playerFides: number;
  incorporationBillPending: boolean;
  ambassadorBillPending: boolean;
  onSeekPosting: () => void;
  onProposeIncorporation: () => void;
}) {
  const relLabel = getRelationshipLabel(province.relationshipScore);
  const relColour = getRelColour(province.relationshipScore);

  return (
    <View style={styles.overviewTab}>
      <Text style={styles.flavorDesc}>{def.flavorDescription}</Text>

      <View style={styles.divider} />

      <Text style={styles.overviewSectionLabel}>RELATIONSHIP WITH ROME</Text>
      <View style={styles.relBarContainer}>
        <View style={styles.relBarBg}>
          <View
            style={[
              styles.relBarFill,
              { width: `${province.relationshipScore}%`, backgroundColor: relColour },
            ]}
          />
          {[15, 30, 50, 70, 85].map(threshold => (
            <View key={threshold} style={[styles.thresholdMarker, { left: `${threshold}%` }]} />
          ))}
        </View>
        <View style={styles.relBarLabels}>
          <Text style={[styles.relScore, { color: relColour }]}>
            {Math.round(province.relationshipScore)} — {relLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.overviewSectionLabel}>INFRASTRUCTURE</Text>
      <View style={styles.relBarBg}>
        <View
          style={[
            styles.relBarFill,
            { width: `${province.infrastructureRating}%`, backgroundColor: COLORS.senatBlue },
          ]}
        />
      </View>
      <Text style={styles.statValue}>{province.infrastructureRating} / 100</Text>

      <View style={styles.divider} />

      <Text style={styles.overviewSectionLabel}>CURRENT GOVERNOR</Text>
      {hasPlayerGovernor ? (
        <View style={styles.roleHolderCard}>
          <View style={styles.roleHolderIcon}>
            <Text style={styles.roleHolderIconText}>★</Text>
          </View>
          <View>
            <Text style={styles.roleHolderName}>
              {province.playerGovernor
                ? 'Family member governing'
                : 'Your family member'}
            </Text>
            <Text style={styles.roleHolderRole}>Governor · Player appointed</Text>
          </View>
        </View>
      ) : hasPlayerAmbassador ? (
        <View style={styles.roleHolderCard}>
          <View style={[styles.roleHolderIcon, { backgroundColor: '#2a3a5a' }]}>
            <Text style={styles.roleHolderIconText}>✦</Text>
          </View>
          <View>
            <Text style={styles.roleHolderName}>Your family member</Text>
            <Text style={styles.roleHolderRole}>Ambassador · Diplomatic posting</Text>
          </View>
        </View>
      ) : province.npcRoleHolder ? (
        <View style={styles.roleHolderCard}>
          <View style={[styles.roleHolderIcon, { backgroundColor: '#2a2a1a' }]}>
            <Text style={styles.roleHolderIconText}>⚖</Text>
          </View>
          <View>
            <Text style={styles.roleHolderName}>{province.npcRoleHolder.name}</Text>
            <Text style={styles.roleHolderRole}>
              NPC Governor ·{' '}
              {province.localSupport >= 30
                ? `${province.npcRoleHolder.trait} (intelligence revealed)`
                : 'Intelligence requires Local Support ≥ 30'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Governor info — incorporated provinces */}
      {province.status === 'incorporated' && !hasPlayerGovernor && (
        <View style={styles.governorInfoBox}>
          <Text style={styles.governorInfoText}>
            🏛 Governorship is assigned by lot after a consular or praetorian term.
            In your final season in office, you may attempt to influence the lot (Intrigus).
          </Text>
        </View>
      )}

      {/* Ambassador posting button — unincorporated only */}
      {province.status === 'unincorporated' && !hasPlayerAmbassador && (
        <TouchableOpacity
          style={[styles.actionButton, ambassadorBillPending && styles.incorporationBannerDisabled]}
          onPress={onSeekPosting}
          disabled={ambassadorBillPending}
          activeOpacity={0.75}
        >
          <Text style={styles.actionButtonText}>
            {ambassadorBillPending
              ? '✦ Ambassador posting bill already tabled — awaiting the Senate\'s vote'
              : '✦ Seek Ambassador Posting'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Revolt warning */}
      {province.revoltActive && (
        <View style={styles.revoltBanner}>
          <Text style={styles.revoltText}>⚔ REVOLT ACTIVE — See Military tab</Text>
        </View>
      )}

      {/* Incorporation available */}
      {province.incorporationBillAvailable && (
        <TouchableOpacity
          style={[
            styles.incorporationBanner,
            (incorporationBillPending || playerFides < 10) && styles.incorporationBannerDisabled,
          ]}
          onPress={onProposeIncorporation}
          disabled={incorporationBillPending || playerFides < 10}
          activeOpacity={0.75}
        >
          <Text style={styles.incorporationText}>
            {incorporationBillPending
              ? '🏛 Incorporation bill tabled — awaiting the Senate\'s vote'
              : '🏛 Table an Incorporation Bill (10 Fides) — absorb this territory permanently'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PolicyTab({
  province,
  def,
  hasPlayerGovernor,
  hasPlayerAmbassador,
  playerFides,
  playerDenarii,
  governorMartial,
  onPolicyChange,
  onAmbassadorAction,
}: {
  province: CityState;
  def: NonNullable<ReturnType<typeof getCityDefinition>>;
  hasPlayerGovernor: boolean;
  hasPlayerAmbassador: boolean;
  playerFides: number;
  playerDenarii: number;
  governorMartial: number;
  onPolicyChange: (policy: GovernorPolicy) => void;
  onAmbassadorAction: (actionId: AmbassadorActionId) => void;
}) {
  if (hasPlayerGovernor && province.playerGovernor) {
    return (
      <PolicyBoard
        policy={province.playerGovernor.policy}
        onPolicyChange={onPolicyChange}
        governorMartial={governorMartial}
        readOnly={false}
      />
    );
  }

  if (hasPlayerAmbassador && province.playerAmbassador) {
    return (
      <DiplomatDesk
        province={province}
        ambassador={province.playerAmbassador}
        playerFides={playerFides}
        playerDenarii={playerDenarii}
        onAction={onAmbassadorAction}
      />
    );
  }

  if (province.npcRoleHolder) {
    return (
      <PolicyBoard
        policy={province.npcRoleHolder.policy}
        onPolicyChange={() => {}}
        governorMartial={0}
        readOnly={true}
      />
    );
  }

  return (
    <View style={styles.noPostingView}>
      <Text style={styles.noPostingText}>
        No player posting in this city. Seek an ambassador role to access policy controls.
      </Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelColour(score: number): string {
  if (score <= 15) return COLORS.crimson;
  if (score <= 30) return '#c05020';
  if (score <= 50) return COLORS.dust;
  if (score <= 70) return '#8aaa6a';
  return COLORS.laurel;
}

function getStatusColour(province: CityState, status: string): string {
  if (status === 'heartland') return COLORS.gold;
  if (status === 'foreign') return province.owner === 'carthage' ? '#4a2a5a' : '#3a5a5a';
  if (province.revoltActive) return COLORS.crimson;
  if (province.playerGovernor) return '#c47a4a';
  if (province.playerAmbassador) return '#5a8aaa';
  return '#5a6b3a';
}

function getForeignLabel(
  def: NonNullable<ReturnType<typeof getCityDefinition>>,
  province: CityState,
): string {
  if (province.owner === 'carthage') return 'Carthaginian Territory';
  if (def.clientOf) return `Independent — Client of ${def.clientOf === 'carthage' ? 'Carthage' : def.clientOf}`;
  return 'Independent Power';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#2e2a24',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  } as ViewStyle,

  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  headerLeft: { flex: 1 } as ViewStyle,

  provinceName: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  } as TextStyle,

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  } as ViewStyle,

  statusDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,

  statusLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
  } as TextStyle,

  closeButton: { padding: SPACING.sm } as ViewStyle,

  closeText: {
    color: COLORS.dust,
    fontSize: 18,
    lineHeight: 20,
  } as TextStyle,

  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  } as ViewStyle,

  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  } as ViewStyle,

  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  } as ViewStyle,

  tabText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
  } as TextStyle,

  tabTextActive: {
    color: COLORS.gold,
    fontWeight: '700',
  } as TextStyle,

  tabBadge: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.crimson,
    marginTop: -4,
  } as ViewStyle,

  content: { flex: 1 } as ViewStyle,

  contentInner: {
    paddingBottom: 140,
  } as ViewStyle,

  // Heartland
  heartlandView: {
    padding: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,

  heartlandIcon: { fontSize: 40, marginBottom: SPACING.md } as TextStyle,

  heartlandTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  } as TextStyle,

  heartlandDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    textAlign: 'center',
  } as TextStyle,

  // Overview tab
  overviewTab: { padding: SPACING.md } as ViewStyle,

  flavorDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: SPACING.md,
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  } as ViewStyle,

  overviewSectionLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  } as TextStyle,

  relBarContainer: { marginBottom: SPACING.md } as ViewStyle,

  relBarBg: {
    height: 8,
    backgroundColor: '#1a1410',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  } as ViewStyle,

  relBarFill: { height: '100%', borderRadius: 4 } as ViewStyle,

  thresholdMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  } as ViewStyle,

  relBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  } as ViewStyle,

  relScore: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,

  statValue: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
    marginBottom: SPACING.md,
  } as TextStyle,

  roleHolderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#1a1410',
    borderRadius: 6,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  roleHolderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3a2a10',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  roleHolderIconText: { color: COLORS.gold, fontSize: 14 } as TextStyle,

  roleHolderName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,

  roleHolderRole: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  } as TextStyle,

  governorInfoBox: {
    backgroundColor: '#1a1814',
    borderRadius: 6,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  governorInfoText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  } as TextStyle,

  actionButton: {
    backgroundColor: '#1a3018',
    borderRadius: 6,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  actionButtonText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,

  revoltBanner: {
    backgroundColor: '#2a0808',
    borderRadius: 6,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.crimson,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  revoltText: {
    color: COLORS.crimson,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textAlign: 'center',
  } as TextStyle,

  incorporationBanner: {
    backgroundColor: '#1a2818',
    borderRadius: 6,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.laurel,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  incorporationBannerDisabled: {
    opacity: 0.5,
  } as ViewStyle,

  incorporationText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  } as TextStyle,

  noPostingView: {
    padding: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,

  noPostingText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  } as TextStyle,
});
