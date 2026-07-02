import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import { useGameStore } from '../state/gameStore';
import MapView from '../components/provinciae/MapView';
import ProvinceSheet from '../components/provinciae/ProvinceSheet';
import type { GovernorPolicy } from '../models/province';
import type { AmbassadorActionId } from '../engine/provinceEngine';
import { getProvinceDefinition } from '../data/provinceDefinitions';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_SNAP_HEIGHT = SCREEN_HEIGHT * 0.72;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProvinciaeScreen() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sheetVisible = selectedProvinceId !== null;

  // ── Store state ──────────────────────────────────────────────────────────────
  const provinces                  = useGameStore(s => s.provinces);
  const imperium                   = useGameStore(s => s.imperium);
  const fides                      = useGameStore(s => s.fides);
  const denarii                    = useGameStore(s => s.denarii);
  const family                     = useGameStore(s => s.family);
  const clients                    = useGameStore(s => s.clients);
  const campaignVotes              = useGameStore(s => s.campaignVotes);
  const pendingGovernorAssignment  = useGameStore(s => s.pendingGovernorAssignment);
  const rigLotAvailable            = useGameStore(s => s.rigLotAvailable);
  const pendingCommanderElection   = useGameStore(s => s.pendingCommanderElection);
  const officerVolunteers          = useGameStore(s => s.officerVolunteers);

  // ── Store actions ────────────────────────────────────────────────────────────
  const updateProvincePolicy       = useGameStore(s => s.updateProvincePolicy);
  const resolveAmbassadorAction    = useGameStore(s => s.resolveAmbassadorAction);
  const purchaseProvinceAsset      = useGameStore(s => s.purchaseProvinceAsset);
  const upgradeProvinceAsset       = useGameStore(s => s.upgradeProvinceAsset);
  const recruitProvincialClient    = useGameStore(s => s.recruitProvincialClient);
  const attemptRigTheLot           = useGameStore(s => s.attemptRigTheLot);
  const chooseGovernorProvince     = useGameStore(s => s.chooseGovernorProvince);
  const dismissGovernorAssignment  = useGameStore(s => s.dismissGovernorAssignment);
  const nominateCommander          = useGameStore(s => s.nominateCommander);
  const voteForCommander           = useGameStore(s => s.voteForCommander);
  const speechForCommander         = useGameStore(s => s.speechForCommander);
  const commitCampaignSeason       = useGameStore(s => s.commitCampaignSeason);
  const resolveCampaignEvent       = useGameStore(s => s.resolveCampaignEvent);
  const volunteerAsOfficer         = useGameStore(s => s.volunteerAsOfficer);
  const resolveOfficerDecisionAction = useGameStore(s => s.resolveOfficerDecisionAction);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedProvince = provinces.find(p => p.id === selectedProvinceId);

  const governorCharacterId = selectedProvince?.playerGovernor?.characterId;
  const governorCharacter = governorCharacterId
    ? family.find(c => c.id === governorCharacterId)
    : null;
  const governorMartial = governorCharacter?.skills.martial ?? 0;

  const recruitedClientIds = clients
    .filter(c => (c as any).isProvincialClient)
    .map(c => (c as any).provincialClientDefId ?? c.id);

  const playerPostings = provinces.filter(p => p.playerGovernor || p.playerAmbassador);
  const activeCampaigns = provinces.filter(p => p.activeCampaign && !p.activeCampaign.resolved);
  const pendingElection = pendingCommanderElection && !pendingCommanderElection.resolved;

  // Officer volunteer for selected province
  const selectedOfficerVolunteer = selectedProvinceId
    ? officerVolunteers.find(v => v.provinceId === selectedProvinceId && !v.resolved) ?? null
    : null;

  // Commander election for selected province
  const selectedCommanderElection =
    pendingCommanderElection?.provinceId === selectedProvinceId && !pendingCommanderElection.resolved
      ? pendingCommanderElection
      : null;

  // ── Sheet animation ──────────────────────────────────────────────────────────

  function openSheet(provinceId: string) {
    setSelectedProvinceId(provinceId);
    Animated.spring(sheetAnim, {
      toValue: SCREEN_HEIGHT - SHEET_SNAP_HEIGHT,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closeSheet() {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: false,
    }).start(() => setSelectedProvinceId(null));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          sheetAnim.setValue(SCREEN_HEIGHT - SHEET_SNAP_HEIGHT + gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(sheetAnim, {
            toValue: SCREEN_HEIGHT - SHEET_SNAP_HEIGHT,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>

      {/* ── Governor Assignment Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!pendingGovernorAssignment}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚖ PROVINCIAL LOT</Text>
            <Text style={styles.modalDesc}>
              {pendingGovernorAssignment?.characterName} has completed their term in office
              and is eligible for a provincial governorship.
            </Text>

            {/* Rig the lot — only in final season and not yet attempted */}
            {rigLotAvailable && pendingGovernorAssignment && !pendingGovernorAssignment.rigAttempted && (
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnRig]}
                onPress={() => {
                  Alert.alert(
                    'Attempt to Rig the Lot',
                    'Use your Intrigus to influence which province is assigned. Success is not guaranteed.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Attempt', onPress: attemptRigTheLot },
                    ]
                  );
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.modalBtnText}>🎲 Attempt to Rig the Lot</Text>
              </TouchableOpacity>
            )}

            {/* Player chooses — rig succeeded */}
            {pendingGovernorAssignment?.rigSucceeded && (
              <>
                <Text style={styles.modalSubtitle}>Choose your province:</Text>
                {provinces
                  .filter(p => {
                    const def = getProvinceDefinition(p.id);
                    return def?.status === 'incorporated' && !p.playerGovernor && p.id !== 'latium';
                  })
                  .map(p => {
                    const def = getProvinceDefinition(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.provinceChoiceBtn}
                        onPress={() => chooseGovernorProvince(p.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.provinceChoiceName}>{def?.name ?? p.id}</Text>
                        <Text style={styles.provinceChoiceStats}>
                          Relationship {p.relationshipScore} · Infrastructure {p.infrastructureRating}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </>
            )}

            {/* Random lot drawn — show result */}
            {pendingGovernorAssignment?.assignedProvinceId && !pendingGovernorAssignment.rigSucceeded && (
              <>
                <Text style={styles.modalSubtitle}>Assigned by lot:</Text>
                <View style={styles.lotResult}>
                  <Text style={styles.lotResultProvince}>
                    {pendingGovernorAssignment.assignedProvinceId.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={dismissGovernorAssignment}
                  activeOpacity={0.75}
                >
                  <Text style={styles.modalBtnTextDark}>Accept Appointment</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>PROVINCIAE</Text>
        <View style={styles.imperiumBadge}>
          <Text style={styles.imperiumLabel}>IMPERIUM</Text>
          <Text style={styles.imperiumValue}>{imperium}</Text>
        </View>
      </View>

      {/* Active posting banners */}
      {playerPostings.map(p => {
        const isGov = !!p.playerGovernor;
        return (
          <View key={p.id} style={styles.postingBanner}>
            <View style={[styles.postingDot, { backgroundColor: isGov ? '#c47a4a' : COLORS.senate }]} />
            <Text style={styles.postingText}>
              {p.id.replace(/_/g, ' ').toUpperCase()} ·{' '}
              {isGov ? 'Governor posting active' : 'Ambassador posting active'}
            </Text>
          </View>
        );
      })}

      {/* Commander election pending banner */}
      {pendingElection && (
        <TouchableOpacity
          style={[styles.postingBanner, styles.campaignBanner]}
          onPress={() => {
            const prov = provinces.find(p => p.id === pendingCommanderElection!.provinceId);
            if (prov) openSheet(prov.id);
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.postingDot, { backgroundColor: COLORS.gold }]} />
          <Text style={styles.postingText}>
            ⚖ Commander election pending — {pendingCommanderElection!.provinceId.replace(/_/g, ' ').toUpperCase()} · Tap to open Military tab
          </Text>
        </TouchableOpacity>
      )}

      {/* Active campaigns banners */}
      {activeCampaigns.map(p => (
        <TouchableOpacity
          key={p.id}
          style={[styles.postingBanner, styles.campaignBanner]}
          onPress={() => openSheet(p.id)}
          activeOpacity={0.75}
        >
          <View style={[styles.postingDot, { backgroundColor: COLORS.crimson }]} />
          <Text style={styles.postingText}>
            ⚔ {p.id.replace(/_/g, ' ').toUpperCase()} · Campaign —{' '}
            Progress {p.activeCampaign!.campaignProgress}/100 · Enemy {p.activeCampaign!.enemyStrength}/100
          </Text>
        </TouchableOpacity>
      ))}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          provinces={provinces}
          onProvincePress={openSheet}
          selectedProvinceId={selectedProvinceId}
        />
      </View>

      {/* Map legend */}
      <View style={styles.legend}>
        {[
          { colour: COLORS.gold, label: 'Heartland' },
          { colour: '#c47a4a', label: 'Player Governor' },
          { colour: '#5a6b3a', label: 'NPC Governor' },
          { colour: COLORS.crimson, label: 'Revolt' },
        ].map(item => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.colour }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Bottom sheet overlay */}
      {sheetVisible && selectedProvince && (
        <>
          <Animated.View
            style={[
              styles.scrim,
              {
                opacity: sheetAnim.interpolate({
                  inputRange: [SCREEN_HEIGHT - SHEET_SNAP_HEIGHT, SCREEN_HEIGHT],
                  outputRange: [0.5, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            // @ts-ignore
            pointerEvents="none"
          />

          <Animated.View
            style={[styles.sheetContainer, { top: sheetAnim }]}
            {...panResponder.panHandlers}
          >
            <ProvinceSheet
              province={selectedProvince}
              family={family}
              playerFides={fides}
              playerDenarii={denarii}
              playerImperium={imperium}
              playerGoverningMartial={governorMartial}
              recruitedClientIds={recruitedClientIds}
              commanderElection={selectedCommanderElection}
              officerVolunteer={selectedOfficerVolunteer}
              campaignVotes={campaignVotes}
              onClose={closeSheet}
              onPolicyChange={(provinceId, policy) => updateProvincePolicy(provinceId, policy)}
              onAmbassadorAction={(provinceId, actionId) => resolveAmbassadorAction(provinceId, actionId)}
              onPurchaseAsset={(provinceId, assetId) => purchaseProvinceAsset(provinceId, assetId)}
              onUpgradeAsset={(provinceId, assetId) => upgradeProvinceAsset(provinceId, assetId)}
              onRecruitClient={(provinceId, clientId) => recruitProvincialClient(provinceId, clientId)}
              onSeekPosting={(provinceId) => {
                // Ambassador posting for unincorporated provinces only
                console.log(`Seek ambassador posting in ${provinceId}`);
              }}
              onCommitCampaignSeason={(provinceId, allocation) =>
                commitCampaignSeason(provinceId, allocation)
              }
              onResolveCampaignEvent={(provinceId, eventId, optionId) =>
                resolveCampaignEvent(provinceId, eventId, optionId)
              }
              onNominateCommander={(provinceId, candidateId) =>
                nominateCommander(provinceId, candidateId)
              }
              onVoteCommander={(leaderId, vote) => voteForCommander(leaderId, vote)}
              onSpeechCommander={(provinceId) => speechForCommander(provinceId)}
              onVolunteerOfficer={(provinceId, characterId) =>
                volunteerAsOfficer(provinceId, characterId)
              }
              onResolveOfficerDecision={(provinceId, decisionIndex, tookRisk) =>
                resolveOfficerDecisionAction(provinceId, decisionIndex, tookRisk)
              }
            />
          </Animated.View>
        </>
      )}

      <SeasonOverlay />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: RESOURCE_BAR_HEIGHT,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  } as TextStyle,

  imperiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#1a1a2a',
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3a3a6a',
  } as ViewStyle,

  imperiumLabel: {
    color: '#8a8acc',
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
  } as TextStyle,

  imperiumValue: {
    color: '#aaaaee',
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,

  postingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#1a2018',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  campaignBanner: {
    backgroundColor: '#1a1218',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.crimson,
  } as ViewStyle,

  postingDot: { width: 6, height: 6, borderRadius: 3 } as ViewStyle,

  postingText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    flex: 1,
  } as TextStyle,

  mapContainer: { flex: 1, overflow: 'hidden' } as ViewStyle,

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#1a1714',
  } as ViewStyle,

  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 } as ViewStyle,

  legendDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,

  legendLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  } as TextStyle,

  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  } as ViewStyle,

  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_SNAP_HEIGHT,
  } as ViewStyle,

  // Governor Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,

  modalCard: {
    backgroundColor: '#2e2a24',
    borderRadius: 12,
    padding: SPACING.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.gold,
  } as ViewStyle,

  modalTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: 1,
  } as TextStyle,

  modalDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.dust,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: SPACING.md,
  } as TextStyle,

  modalSubtitle: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.goldDim ?? COLORS.dust,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  } as TextStyle,

  provinceChoiceBtn: {
    backgroundColor: '#1a1814',
    borderRadius: 6,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  provinceChoiceName: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble ?? COLORS.gold,
  } as TextStyle,

  provinceChoiceStats: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  } as TextStyle,

  lotResult: {
    backgroundColor: `${COLORS.gold}18`,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
  } as ViewStyle,

  lotResultProvince: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.gold,
    letterSpacing: 1,
  } as TextStyle,

  modalBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  } as ViewStyle,

  modalBtnRig: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  modalBtnText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.dust,
  } as TextStyle,

  modalBtnTextDark: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#1a1410',
  } as TextStyle,
});
