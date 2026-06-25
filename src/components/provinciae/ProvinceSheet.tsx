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
import type { ProvinceState, GovernorPolicy } from '../../models/province';
import { getRelationshipLabel, getRelationshipTier } from '../../models/province';
import { getProvinceDefinition } from '../../data/provinceDefinitions';
import PolicyBoard from './PolicyBoard';
import DiplomatDesk from './DiplomatDesk';
import ProvinceAssetGrid from './ProvinceAssetGrid';
import ProvincialClientCard from './ProvincialClientCard';
import type { AmbassadorActionId } from '../../engine/provinceEngine';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetTab = 'overview' | 'policy' | 'assets' | 'clients';

interface ProvinceSheetProps {
  province: ProvinceState;
  playerGratia: number;
  playerDenarii: number;
  playerGoverningMartial: number;
  recruitedClientIds: string[];
  onClose: () => void;
  onPolicyChange: (provinceId: string, policy: GovernorPolicy) => void;
  onAmbassadorAction: (provinceId: string, actionId: AmbassadorActionId) => void;
  onPurchaseAsset: (provinceId: string, assetId: string) => void;
  onUpgradeAsset: (provinceId: string, assetId: string) => void;
  onRecruitClient: (provinceId: string, clientId: string) => void;
  onSeekPosting: (provinceId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProvinceSheet({
  province,
  playerGratia,
  playerDenarii,
  playerGoverningMartial,
  recruitedClientIds,
  onClose,
  onPolicyChange,
  onAmbassadorAction,
  onPurchaseAsset,
  onUpgradeAsset,
  onRecruitClient,
  onSeekPosting,
}: ProvinceSheetProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const def = getProvinceDefinition(province.id);
  if (!def) return null;

  const isHeartland = def.status === 'heartland';
  const hasPlayerGovernor = !!province.playerGovernor;
  const hasPlayerAmbassador = !!province.playerAmbassador;
  const relationshipTier = getRelationshipTier(province.relationshipScore);

  // Tab 2 label adapts to context
  const policyTabLabel = hasPlayerGovernor
    ? 'POLICY'
    : hasPlayerAmbassador
    ? 'DIPLOMAT'
    : 'INTEL';

  const tabs: { id: SheetTab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'policy', label: policyTabLabel },
    { id: 'assets', label: 'ASSETS' },
    { id: 'clients', label: 'CLIENTS' },
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
            <View style={[styles.statusDot, { backgroundColor: getStatusColour(province, def.status) }]} />
            <Text style={styles.statusLabel}>
              {isHeartland ? 'Heartland — Rome Itself' : def.status === 'incorporated' ? 'Incorporated Province' : 'Unincorporated Territory'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tab strip */}
      {!isHeartland && (
        <View style={styles.tabStrip}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content — extra bottom padding clears the EndSeason button */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentInner}
      >
        {isHeartland ? (
          <HeartlandView def={def} />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                province={province}
                def={def}
                hasPlayerGovernor={hasPlayerGovernor}
                hasPlayerAmbassador={hasPlayerAmbassador}
                onSeekPosting={() => onSeekPosting(province.id)}
              />
            )}
            {activeTab === 'policy' && (
              <PolicyTab
                province={province}
                def={def}
                hasPlayerGovernor={hasPlayerGovernor}
                hasPlayerAmbassador={hasPlayerAmbassador}
                playerGratia={playerGratia}
                playerDenarii={playerDenarii}
                governorMartial={playerGoverningMartial}
                onPolicyChange={(policy) => onPolicyChange(province.id, policy)}
                onAmbassadorAction={(actionId) => onAmbassadorAction(province.id, actionId)}
              />
            )}
            {activeTab === 'assets' && (
              <ProvinceAssetGrid
                province={province}
                playerDenarii={playerDenarii}
                onPurchase={(assetId) => onPurchaseAsset(province.id, assetId)}
                onUpgrade={(assetId) => onUpgradeAsset(province.id, assetId)}
              />
            )}
            {activeTab === 'clients' && (
              <ProvincialClientCard
                province={province}
                recruitedClientIds={recruitedClientIds}
                onRecruit={(clientId) => onRecruitClient(province.id, clientId)}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function HeartlandView({ def }: { def: ReturnType<typeof getProvinceDefinition> }) {
  if (!def) return null;
  return (
    <View style={styles.heartlandView}>
      <Text style={styles.heartlandIcon}>🏛</Text>
      <Text style={styles.heartlandTitle}>{def.latinName}</Text>
      <Text style={styles.heartlandDesc}>{def.flavorDescription}</Text>
    </View>
  );
}

function OverviewTab({
  province,
  def,
  hasPlayerGovernor,
  hasPlayerAmbassador,
  onSeekPosting,
}: {
  province: ProvinceState;
  def: NonNullable<ReturnType<typeof getProvinceDefinition>>;
  hasPlayerGovernor: boolean;
  hasPlayerAmbassador: boolean;
  onSeekPosting: () => void;
}) {
  const relTier = getRelationshipTier(province.relationshipScore);
  const relLabel = getRelationshipLabel(province.relationshipScore);
  const relColour = getRelColour(province.relationshipScore);

  return (
    <View style={styles.overviewTab}>
      {/* Flavour description */}
      <Text style={styles.flavorDesc}>{def.flavorDescription}</Text>

      <View style={styles.divider} />

      {/* Relationship bar */}
      <Text style={styles.overviewSectionLabel}>RELATIONSHIP WITH ROME</Text>
      <View style={styles.relBarContainer}>
        <View style={styles.relBarBg}>
          <View
            style={[
              styles.relBarFill,
              {
                width: `${province.relationshipScore}%`,
                backgroundColor: relColour,
              },
            ]}
          />
          {/* Threshold markers at 15, 30, 50, 70, 85 */}
          {[15, 30, 50, 70, 85].map(threshold => (
            <View
              key={threshold}
              style={[styles.thresholdMarker, { left: `${threshold}%` }]}
            />
          ))}
        </View>
        <View style={styles.relBarLabels}>
          <Text style={[styles.relScore, { color: relColour }]}>
            {Math.round(province.relationshipScore)} — {relLabel}
          </Text>
        </View>
      </View>

      {/* Infrastructure */}
      <Text style={styles.overviewSectionLabel}>INFRASTRUCTURE</Text>
      <View style={styles.relBarBg}>
        <View
          style={[
            styles.relBarFill,
            {
              width: `${province.infrastructureRating}%`,
              backgroundColor: COLORS.senate,
            },
          ]}
        />
      </View>
      <Text style={styles.statValue}>{province.infrastructureRating} / 100</Text>

      <View style={styles.divider} />

      {/* Role holder */}
      <Text style={styles.overviewSectionLabel}>CURRENT GOVERNOR</Text>
      {hasPlayerGovernor ? (
        <View style={styles.roleHolderCard}>
          <View style={styles.roleHolderIcon}>
            <Text style={styles.roleHolderIconText}>★</Text>
          </View>
          <View>
            <Text style={styles.roleHolderName}>Your family member</Text>
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

      {/* Action buttons */}
      {!hasPlayerGovernor && !hasPlayerAmbassador && (
        <TouchableOpacity style={styles.actionButton} onPress={onSeekPosting} activeOpacity={0.75}>
          <Text style={styles.actionButtonText}>
            {def.status === 'incorporated' ? '⚖ Seek Governorship' : '✦ Seek Ambassador Posting'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Revolt warning */}
      {province.revoltActive && (
        <View style={styles.revoltBanner}>
          <Text style={styles.revoltText}>⚔ REVOLT ACTIVE — Military campaign required to suppress</Text>
        </View>
      )}

      {/* Incorporation available */}
      {province.incorporationBillAvailable && (
        <View style={styles.incorporationBanner}>
          <Text style={styles.incorporationText}>
            🏛 Incorporation bill available — table in the Curia to absorb this territory permanently
          </Text>
        </View>
      )}
    </View>
  );
}

function PolicyTab({
  province,
  def,
  hasPlayerGovernor,
  hasPlayerAmbassador,
  playerGratia,
  playerDenarii,
  governorMartial,
  onPolicyChange,
  onAmbassadorAction,
}: {
  province: ProvinceState;
  def: NonNullable<ReturnType<typeof getProvinceDefinition>>;
  hasPlayerGovernor: boolean;
  hasPlayerAmbassador: boolean;
  playerGratia: number;
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
        playerGratia={playerGratia}
        playerDenarii={playerDenarii}
        onAction={onAmbassadorAction}
      />
    );
  }

  // NPC governor — read-only with intelligence gate
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
        No player posting in this province. Seek a governorship or ambassador role to access policy controls.
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

function getStatusColour(province: ProvinceState, status: string): string {
  if (status === 'heartland') return COLORS.gold;
  if (province.revoltActive) return COLORS.crimson;
  if (province.playerGovernor) return '#c47a4a';
  if (province.playerAmbassador) return '#5a8aaa';
  return '#5a6b3a';
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

  headerLeft: {
    flex: 1,
  } as ViewStyle,

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

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,

  statusLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
  } as TextStyle,

  closeButton: {
    padding: SPACING.sm,
  } as ViewStyle,

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

  content: {
    flex: 1,
  } as ViewStyle,

  contentInner: {
    paddingBottom: 140, // clears EndSeason button (≈64px) + seek button height + safe area
  } as ViewStyle,

  // Heartland
  heartlandView: {
    padding: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,

  heartlandIcon: {
    fontSize: 40,
    marginBottom: SPACING.md,
  } as TextStyle,

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
  overviewTab: {
    padding: SPACING.md,
  } as ViewStyle,

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

  relBarContainer: {
    marginBottom: SPACING.md,
  } as ViewStyle,

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

  relBarFill: {
    height: '100%',
    borderRadius: 4,
  } as ViewStyle,

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

  roleHolderIconText: {
    color: COLORS.gold,
    fontSize: 14,
  } as TextStyle,

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
