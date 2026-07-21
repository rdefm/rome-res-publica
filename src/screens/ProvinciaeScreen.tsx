import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, FONTS, SPACING, RADIUS, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import { useGameStore } from '../state/gameStore';
import MapView from '../components/provinciae/MapView';
import CitySheet from '../components/provinciae/CitySheet';
import LatiumSheet from '../components/provinciae/LatiumSheet';
import RegionSheet from '../components/provinciae/RegionSheet';
import WarStatusModal from '../components/provinciae/WarStatusModal';
import type { GovernorPolicy } from '../models/city';
import type { AmbassadorActionId } from '../engine/cityEngine';
import type { RegionId } from '../models/theatre';
import { calcTotalImperium } from '../engine/troopEngine';
import { reachable } from '../engine/movementEngine';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_SNAP_HEIGHT = SCREEN_HEIGHT * 0.72;

export default function ProvinciaeScreen() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  // Campaign Map plan, Chunk C2 — a region and a city are different tap
  // targets on the map now (Chunk C1); mutually exclusive with
  // selectedProvinceId, sharing the same bottom-sheet animation/container.
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>(null);
  const [focusArmyId, setFocusArmyId] = useState<string | null>(null);
  // Campaign Map plan, Chunk C5 — order mode is its own top-level UI state,
  // mutually exclusive with the bottom sheet (entering it always closes
  // whichever sheet is open — see enterOrderMode below).
  const [orderModeArmyId, setOrderModeArmyId] = useState<string | null>(null);
  const [orderModeForcedMarch, setOrderModeForcedMarch] = useState(false);
  // July Fixes plan, Chunk C — war status banner/modal.
  const [warStatusModalOpen, setWarStatusModalOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sheetVisible = selectedProvinceId !== null || selectedRegionId !== null;

  // ── Store state — only fields that exist in GameState ────────────────────────
  const provinces                = useGameStore(s => s.cities);
  const imperium                 = useGameStore(s => s.imperium);
  const fides                    = useGameStore(s => s.fides);
  const denarii                  = useGameStore(s => s.denarii);
  const family                   = useGameStore(s => s.family);
  const clients                  = useGameStore(s => s.clients);
  const campaignVotes            = useGameStore(s => s.campaignVotes);
  const selectedCharacterId      = useGameStore(s => s.selectedCharacterId);
  const bills                    = useGameStore(s => s.bills);
  const armies                   = useGameStore(s => s.armies);
  const wars                     = useGameStore(s => s.wars);
  const theatre                  = useGameStore(s => s.theatre);
  const activeCommand            = useGameStore(s => s.activeCommand);
  const seasonIndex               = useGameStore(s => s.seasonIndex);
  // Campaign Map plan, Chunk C7 — turn-end playback.
  const campaignLog              = useGameStore(s => s.campaignLog);
  const dismissCampaignLog        = useGameStore(s => s.dismissCampaignLog);

  // ── Store actions — only actions that exist in GameActions ───────────────────
  const updateProvincePolicy     = useGameStore(s => s.updateCityPolicy);
  const resolveAmbassadorAction  = useGameStore(s => s.resolveAmbassadorAction);
  const proposeIncorporationBill = useGameStore(s => s.proposeIncorporationBill);
  const proposeDeclareWarBill    = useGameStore(s => s.proposeDeclareWarBill);
  const seekAmbassadorPosting    = useGameStore(s => s.seekAmbassadorPosting);
  const purchaseProvinceAsset    = useGameStore(s => s.purchaseCityAsset);
  const upgradeProvinceAsset     = useGameStore(s => s.upgradeCityAsset);
  const recruitProvincialClient  = useGameStore(s => s.recruitCityClient);
  const startCampaign            = useGameStore(s => s.startCampaign);
  const volunteerOfficer         = useGameStore(s => s.volunteerOfficer);
  const resolveOfficerDecision   = useGameStore(s => s.resolveOfficerDecision);
  const combineArmies            = useGameStore(s => s.combineArmies);
  const divideArmy               = useGameStore(s => s.divideArmy);
  const assignArmyCommander      = useGameStore(s => s.assignArmyCommander);
  const setArmyStance            = useGameStore(s => s.setArmyStance);
  const raiseTroops              = useGameStore(s => s.raiseTroops);
  const issueMovementOrder       = useGameStore(s => s.issueMovementOrder);
  const clearOrder               = useGameStore(s => s.clearOrder);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedProvince = provinces.find(p => p.id === selectedProvinceId);

  // Imperium display — use selected character, fall back to player character
  const activeCharacter = family.find(c => c.id === selectedCharacterId) ?? family.find(c => c.isPlayer);
  const totalImperium = activeCharacter
    ? calcTotalImperium(activeCharacter.formalImperium, activeCharacter.militaryImperium)
    : 0 as 0 | 1 | 2 | 3;
  const IMPERIUM_LABELS: Record<0 | 1 | 2 | 3, string> = {
    0: 'Privatus',
    1: 'Cum Imperio',
    2: 'Maius Imperium',
    3: 'Imperator',
  };

  // Campaign Map plan, Chunk C3 — same "senateAuthorised = holds a formal
  // office" rule gameStore.raiseLevy already uses for personal levies.
  const paterfamilias = family.find(c => c.isPlayer);
  const playerHoldsOffice = !!paterfamilias?.officeId;
  // Chunk C4 — holding the theatre command sanctions muster the same way.
  const playerHoldsCommand = activeCommand?.holderOwner === 'player';

  const governorCharacterId = selectedProvince?.playerGovernor?.characterId;
  const governorCharacter   = governorCharacterId
    ? family.find(c => c.id === governorCharacterId)
    : null;
  const governorMartial = governorCharacter?.skills.martial ?? 0;

  const recruitedClientIds = clients
    .filter(c => (c as any).isProvincialClient)
    .map(c => (c as any).provincialClientDefId ?? c.id);

  const playerPostings = provinces.filter(p => p.playerGovernor || p.playerAmbassador);

  // July Fixes plan, Chunk C — the one major foreign war (see warEngine.ts's
  // own "primary major war" convention — local-scale revolt wars keep their
  // existing CitySheet/Military-tab UI, not this banner).
  const activeMajorWar = wars.find(w => w.active && w.scale === 'major');

  // ── Sheet animation ──────────────────────────────────────────────────────────

  function openSheet(provinceId: string) {
    setSelectedRegionId(null);
    setFocusArmyId(null);
    setSelectedProvinceId(provinceId);
    Animated.spring(sheetAnim, {
      toValue: SCREEN_HEIGHT - SHEET_SNAP_HEIGHT,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  function openRegionSheet(regionId: RegionId, armyId?: string) {
    setSelectedProvinceId(null);
    setFocusArmyId(armyId ?? null);
    setSelectedRegionId(regionId);
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
    }).start(() => {
      setSelectedProvinceId(null);
      setSelectedRegionId(null);
      setFocusArmyId(null);
    });
  }

  // Campaign Map plan, Chunk C5 — order mode.
  function enterOrderMode(armyId: string) {
    closeSheet();
    setOrderModeForcedMarch(false);
    setOrderModeArmyId(armyId);
  }

  function exitOrderMode() {
    setOrderModeArmyId(null);
  }

  function handleOrderRegionPress(regionId: RegionId) {
    if (!orderModeArmyId) return;
    issueMovementOrder(orderModeArmyId, regionId, orderModeForcedMarch);
    exitOrderMode();
  }

  const orderModeArmy = orderModeArmyId ? armies.find(a => a.id === orderModeArmyId) ?? null : null;
  const orderModeDestinations = orderModeArmy
    ? reachable(orderModeArmy, armies, theatre, seasonIndex, orderModeForcedMarch)
    : null;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onMoveShouldSetPanResponder:  (_, gs) => gs.dy > 8,
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

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>PROVINCIAE</Text>
        <View style={styles.imperiumBadge}>
          <Text style={styles.imperiumLabel}>IMPERIUM</Text>
          <Text style={styles.imperiumValue}>{imperium}</Text>
        </View>
      </View>

      {/* Character Imperium sub-header — below title bar, above map */}
      {activeCharacter && (
        <View style={styles.imperiumSubHeader}>
          <Text style={styles.imperiumSubName}>{activeCharacter.name}</Text>
          <Text style={styles.imperiumSubSep}> | </Text>
          <Text style={styles.imperiumSubValue}>
            {'Imperium: '}{IMPERIUM_LABELS[totalImperium]}{' ('}{totalImperium}{')'}
          </Text>
        </View>
      )}

      {/* Active posting banners */}
      {playerPostings.map(p => {
        const isGov = !!p.playerGovernor;
        return (
          <TouchableOpacity
            key={p.id}
            style={styles.postingBanner}
            onPress={() => openSheet(p.id)}
            activeOpacity={0.75}
          >
            <View style={[styles.postingDot, { backgroundColor: isGov ? '#c47a4a' : '#5a8aaa' }]} />
            <Text style={styles.postingText}>
              {p.id.replace(/_/g, ' ').toUpperCase()} ·{' '}
              {isGov ? 'Governor posting active' : 'Ambassador posting active'}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          provinces={provinces}
          onProvincePress={openSheet}
          selectedProvinceId={selectedProvinceId}
          armies={armies}
          onRegionPress={openRegionSheet}
          orderModeDestinations={orderModeDestinations}
          onOrderRegionPress={handleOrderRegionPress}
          playbackLog={campaignLog}
          onPlaybackComplete={dismissCampaignLog}
        />

        {/* July Fixes plan, Chunk C — war status banner. MapView itself stays
            a pure, store-free rendering component; the banner belongs here. */}
        {activeMajorWar && (
          <TouchableOpacity
            style={styles.warBanner}
            onPress={() => setWarStatusModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.warBannerIcon}>⚔</Text>
            <Text style={styles.warBannerText}>
              {activeMajorWar.enemyId.charAt(0).toUpperCase() + activeMajorWar.enemyId.slice(1)} War
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Campaign Map plan, Chunk C5 — order-mode banner */}
      {orderModeArmy && (
        <View style={styles.orderBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderBannerTitle}>Ordering {orderModeArmy.name}</Text>
            <Text style={styles.orderBannerSub}>Tap a highlighted region, or cancel.</Text>
          </View>
          <TouchableOpacity
            style={[styles.orderBannerToggle, orderModeForcedMarch && styles.orderBannerToggleActive]}
            onPress={() => setOrderModeForcedMarch(v => !v)}
            activeOpacity={0.75}
          >
            <Text style={[styles.orderBannerToggleText, orderModeForcedMarch && styles.orderBannerToggleTextActive]}>
              Forced March
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.orderBannerCancel} onPress={exitOrderMode} activeOpacity={0.75}>
            <Text style={styles.orderBannerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map legend */}
      <View style={styles.legend}>
        {[
          { colour: COLORS.gold,    label: 'Heartland' },
          { colour: '#c47a4a',      label: 'Player Governor' },
          { colour: '#5a6b3a',      label: 'NPC Governor' },
          { colour: COLORS.crimson, label: 'Revolt' },
          { colour: '#4a2a5a',      label: 'Carthaginian' },
          { colour: '#3a5a5a',      label: 'Independent' },
        ].map(item => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.colour }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Bottom sheet overlay */}
      {sheetVisible && (selectedProvince || selectedRegionId) && (
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
            {selectedRegionId ? (
              <RegionSheet
                regionId={selectedRegionId}
                armies={armies}
                cities={provinces}
                theatre={theatre}
                family={family}
                focusArmyId={focusArmyId}
                playerImperium={imperium}
                playerHoldsOffice={playerHoldsOffice}
                playerHoldsCommand={playerHoldsCommand}
                denarii={denarii}
                onClose={closeSheet}
                onCombineArmies={combineArmies}
                onDivideArmy={divideArmy}
                onAssignCommander={assignArmyCommander}
                onSetStance={setArmyStance}
                onRaiseTroops={(tier, targetArmyId) =>
                  selectedRegionId && raiseTroops(selectedRegionId, tier, targetArmyId)
                }
                onOrderMode={enterOrderMode}
                onClearOrder={clearOrder}
              />
            ) : selectedProvince?.id === 'latium' ? (
              <LatiumSheet onClose={closeSheet} />
            ) : selectedProvince ? (
            <CitySheet
              province={selectedProvince}
              family={family}
              playerFides={fides}
              playerDenarii={denarii}
              playerImperium={imperium}
              playerGoverningMartial={governorMartial}
              recruitedClientIds={recruitedClientIds}
              // Military/governor system not yet implemented — pass null/empty stubs
              commanderElection={null}
              officerVolunteer={selectedProvince?.officerVolunteer ?? null}
              campaignVotes={campaignVotes}
              bills={bills}
              onClose={closeSheet}
              onPolicyChange={(provinceId, policy) => updateProvincePolicy(provinceId, policy)}
              onAmbassadorAction={(provinceId, actionId) => resolveAmbassadorAction(provinceId, actionId)}
              onPurchaseAsset={(provinceId, assetId) => purchaseProvinceAsset(provinceId, assetId)}
              onUpgradeAsset={(provinceId, assetId) => upgradeProvinceAsset(provinceId, assetId)}
              onRecruitClient={(provinceId, clientId) => recruitProvincialClient(provinceId, clientId)}
              onSeekPosting={(provinceId) => seekAmbassadorPosting(provinceId)}
              onProposeIncorporation={(provinceId) => proposeIncorporationBill(provinceId)}
              onProposeDeclareWar={(provinceId) => proposeDeclareWarBill(provinceId)}
              onStartCampaign={(provinceId, type) => startCampaign(provinceId, type)}
              onCommitCampaignSeason={() => {}}
              onResolveCampaignEvent={() => {}}
              onNominateCommander={() => {}}
              onVoteCommander={() => {}}
              onSpeechCommander={() => {}}
              onVolunteerOfficer={(provinceId, charId) => volunteerOfficer(provinceId, charId)}
              onResolveOfficerDecision={(provinceId, idx, risk) => resolveOfficerDecision(provinceId, idx, risk)}
            />
            ) : null}
          </Animated.View>
        </>
      )}

      {activeMajorWar && (
        <WarStatusModal
          warId={activeMajorWar.id}
          visible={warStatusModalOpen}
          onClose={() => setWarStatusModalOpen(false)}
        />
      )}

      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: RESOURCE_BAR_HEIGHT,
  } as ViewStyle,

  // Campaign Map plan, Chunk C5 — order mode.
  orderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: '#2e2a24',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 10,
  } as ViewStyle,
  orderBannerTitle: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 13, fontWeight: '700' } as TextStyle,
  orderBannerSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2 } as TextStyle,
  orderBannerToggle: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6,
  } as ViewStyle,
  orderBannerToggleActive: { backgroundColor: '#1a2818', borderColor: COLORS.laurel } as ViewStyle,
  orderBannerToggleText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10 } as TextStyle,
  orderBannerToggleTextActive: { color: '#8fc98f', fontWeight: '700' } as TextStyle,
  orderBannerCancel: {
    borderWidth: 1, borderColor: COLORS.crimson, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6,
  } as ViewStyle,
  orderBannerCancelText: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700' } as TextStyle,

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

  imperiumSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    backgroundColor: '#141210',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  imperiumSubName: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '600',
  } as TextStyle,

  imperiumSubSep: {
    color: COLORS.border,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginHorizontal: 4,
  } as TextStyle,

  imperiumSubValue: {
    color: '#aaaaee',
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.3,
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

  postingDot: { width: 6, height: 6, borderRadius: 3 } as ViewStyle,

  postingText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    flex: 1,
  } as TextStyle,

  mapContainer: { flex: 1, overflow: 'hidden' } as ViewStyle,

  // July Fixes plan, Chunk C — war status banner, pinned top-right over the map.
  warBanner: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,16,12,0.85)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.crimson + 'aa',
  } as ViewStyle,

  warBannerIcon: {
    fontSize: 13,
  } as TextStyle,

  warBannerText: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  } as TextStyle,

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
});
