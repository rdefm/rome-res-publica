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
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import { useGameStore } from '../state/gameStore';
import MapView from '../components/provinciae/MapView';
import ProvinceSheet from '../components/provinciae/ProvinceSheet';
import type { GovernorPolicy } from '../models/province';
import type { AmbassadorActionId } from '../engine/provinceEngine';
import { calcTotalImperium } from '../engine/troopEngine';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_SNAP_HEIGHT = SCREEN_HEIGHT * 0.72;

export default function ProvinciaeScreen() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sheetVisible = selectedProvinceId !== null;

  // ── Store state — only fields that exist in GameState ────────────────────────
  const provinces                = useGameStore(s => s.provinces);
  const imperium                 = useGameStore(s => s.imperium);
  const fides                    = useGameStore(s => s.fides);
  const denarii                  = useGameStore(s => s.denarii);
  const family                   = useGameStore(s => s.family);
  const clients                  = useGameStore(s => s.clients);
  const campaignVotes            = useGameStore(s => s.campaignVotes);
  const selectedCharacterId      = useGameStore(s => s.selectedCharacterId);

  // ── Store actions — only actions that exist in GameActions ───────────────────
  const updateProvincePolicy     = useGameStore(s => s.updateProvincePolicy);
  const resolveAmbassadorAction  = useGameStore(s => s.resolveAmbassadorAction);
  const purchaseProvinceAsset    = useGameStore(s => s.purchaseProvinceAsset);
  const upgradeProvinceAsset     = useGameStore(s => s.upgradeProvinceAsset);
  const recruitProvincialClient  = useGameStore(s => s.recruitProvincialClient);

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

  const governorCharacterId = selectedProvince?.playerGovernor?.characterId;
  const governorCharacter   = governorCharacterId
    ? family.find(c => c.id === governorCharacterId)
    : null;
  const governorMartial = governorCharacter?.skills.martial ?? 0;

  const recruitedClientIds = clients
    .filter(c => (c as any).isProvincialClient)
    .map(c => (c as any).provincialClientDefId ?? c.id);

  const playerPostings = provinces.filter(p => p.playerGovernor || p.playerAmbassador);

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
        />
      </View>

      {/* Map legend */}
      <View style={styles.legend}>
        {[
          { colour: COLORS.gold,    label: 'Heartland' },
          { colour: '#c47a4a',      label: 'Player Governor' },
          { colour: '#5a6b3a',      label: 'NPC Governor' },
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
              // Military/governor system not yet implemented — pass null/empty stubs
              commanderElection={null}
              officerVolunteer={null}
              campaignVotes={campaignVotes}
              onClose={closeSheet}
              onPolicyChange={(provinceId, policy) => updateProvincePolicy(provinceId, policy)}
              onAmbassadorAction={(provinceId, actionId) => resolveAmbassadorAction(provinceId, actionId)}
              onPurchaseAsset={(provinceId, assetId) => purchaseProvinceAsset(provinceId, assetId)}
              onUpgradeAsset={(provinceId, assetId) => upgradeProvinceAsset(provinceId, assetId)}
              onRecruitClient={(provinceId, clientId) => recruitProvincialClient(provinceId, clientId)}
              onSeekPosting={() => {}}
              onCommitCampaignSeason={() => {}}
              onResolveCampaignEvent={() => {}}
              onNominateCommander={() => {}}
              onVoteCommander={() => {}}
              onSpeechCommander={() => {}}
              onVolunteerOfficer={() => {}}
              onResolveOfficerDecision={() => {}}
            />
          </Animated.View>
        </>
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
