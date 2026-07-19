import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS } from '../../utils/theme';
import type { CityState, CityDefinition } from '../../models/city';
import { getRelationshipTier } from '../../models/city';
import { ALL_CITIES } from '../../data/cityDefinitions';
import type { Controller, RegionId } from '../../models/theatre';
import { REGIONS } from '../../data/theatreMap';
import type { Army } from '../../models/army';
import type { ReachableDestination } from '../../engine/movementEngine';
import type { CampaignLog, CampaignLogEntry } from '../../models/campaignLog';

// ─── Layout ───────────────────────────────────────────────────────────────────
//
// Simple approach: render the image at full screen width, height derived from
// the PNG's natural aspect ratio (1024×1536 — the "italy-mosaic" map,
// Campaign Map plan Chunk C2; replaces the earlier map_italia.png, whose
// Mediterranean nodes lived in an undrawn parchment margin. This mosaic
// draws Italy, Sicily, Sardinia/Corsica, AND the African coast directly, so
// every city node now sits on real drawn geography). No cropping. The
// transparent scroll border in the PNG will show the parchment background
// colour. Node positions are fractions of the rendered image dimensions.

const SCREEN_WIDTH = Dimensions.get('window').width;

const PNG_W = 1024;
const PNG_H = 1536;

const MAP_WIDTH  = SCREEN_WIDTH;
const MAP_HEIGHT = SCREEN_WIDTH * (PNG_H / PNG_W); // maintains true aspect ratio

const NODE_SIZE = 28;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeColour(
  province: CityState,
  def: CityDefinition
): { fill: string; border: string } {
  if (def.status === 'heartland') return { fill: COLORS.gold,    border: '#a07828' };
  if (province.status === 'foreign') {
    if (province.owner === 'carthage') return { fill: '#4a2a5a', border: '#7a4a8a' };
    return { fill: '#3a5a5a', border: '#5a8aaa' }; // independent
  }
  if (province.revoltActive)     return { fill: '#8b1a1a',       border: '#cc2222' };
  if (province.playerGovernor)   return { fill: '#c47a4a',       border: '#e8963c' };
  if (province.playerAmbassador) return { fill: '#5a8aaa',       border: '#7ab0cc' };
  const tier = getRelationshipTier(province.relationshipScore);
  if (tier === 'hostile' || tier === 'restless') return { fill: '#6b3030', border: '#8b4444' };
  return { fill: '#5a6b3a', border: '#7a8a50' };
}

function getRelPillColour(score: number): string {
  if (score <= 15) return COLORS.crimson;
  if (score <= 30) return '#c07030';
  if (score <= 50) return COLORS.dust;
  if (score <= 70) return '#8aaa6a';
  return COLORS.laurel;
}

// ─── Region borders (Campaign Map plan, Chunk C2 — map-visual work) ─────────
//
// Hand-traced per region (tools/theatre-map/region-border-tracer-tool.html),
// stored as fractions on Region.borderPoints (models/theatre.ts). Purely a
// rendering aid — no engine reads this, adjacency/control/combat all key off
// RegionId. Drawn as straight rotated-View line segments rather than
// react-native-svg: that package isn't a project dependency, and adding one
// touches package.json/app.json, which CLAUDE.md reserves for tooling-only
// tasks. Colour keys off each Region's static startingController for now —
// no engine writes TheatreState.controllers yet (C1's own note), so there is
// no live value to prefer over it; a future chunk that actually flips
// control should thread the live theatre.controllers through as a prop
// instead of reading this static fallback.
const REGION_BORDER_COLOR: Record<Controller, string> = {
  rome:     '#d69a3a',
  carthage: '#a860c9',
  neutral:  '#4ab8b8',
};

const BORDER_STROKE_WIDTH = 2;

/** One straight segment from (x1,y1) to (x2,y2) in already-scaled pixel
 *  coordinates, drawn as a thin View rotated around its own midpoint —
 *  the classic dependency-free "line between two points" RN technique. */
function BorderSegment({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null; // degenerate segment (two traced points landed on top of each other)
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top:  (y1 + y2) / 2 - BORDER_STROKE_WIDTH / 2,
        width: length,
        height: BORDER_STROKE_WIDTH,
        backgroundColor: color,
        opacity: 0.8,
        transform: [{ rotate: `${angleDeg}deg` }],
      }}
    />
  );
}

/** Closed-loop outline for one region — every consecutive pair of traced
 *  points, plus the closing segment back to the first point. Regions with
 *  no borderPoints yet (or fewer than 3 — too few to read as a shape) render
 *  nothing, falling back to just their city pins. */
function RegionBorderOutline({ regionId }: { regionId: string }) {
  const region = REGIONS.find(r => r.id === regionId);
  const pts = region?.borderPoints;
  if (!region || !pts || pts.length < 3) return null;

  const color = REGION_BORDER_COLOR[region.startingController];
  const scaled = pts.map(p => ({ x: p.x * MAP_WIDTH, y: p.y * MAP_HEIGHT }));

  return (
    <>
      {scaled.map((p, i) => {
        const next = scaled[(i + 1) % scaled.length];
        return (
          <BorderSegment
            key={i}
            x1={p.x} y1={p.y}
            x2={next.x} y2={next.y}
            color={color}
          />
        );
      })}
    </>
  );
}

/** Mean of a region's traced border points, in already-scaled pixel
 *  coordinates — used both as the region-ground tap target's centre and as
 *  the army marker's fallback position (a region with no army stationed at
 *  a specific city, or no border traced yet). Not the same "centroid" idea
 *  as a true polygon centroid (which would need triangulation); a plain
 *  mean of the traced vertices is a fine approximation for a soft touch
 *  target and a label position. */
function regionCentroidPx(region: (typeof REGIONS)[number]): { x: number; y: number } {
  const pts = region.borderPoints;
  if (!pts || pts.length === 0) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: (sum.x / pts.length) * MAP_WIDTH, y: (sum.y / pts.length) * MAP_HEIGHT };
}

/** Average distance from the centroid to each traced point — a soft radius
 *  for the tap target, deliberately smaller than the region's full extent
 *  so it doesn't compete with neighbouring regions' tap targets or city
 *  pins for touches. */
function regionTapRadiusPx(region: (typeof REGIONS)[number], centroid: { x: number; y: number }): number {
  const pts = region.borderPoints;
  if (!pts || pts.length === 0) return 40;
  const mean = pts.reduce((sum, p) => {
    const dx = p.x * MAP_WIDTH - centroid.x;
    const dy = p.y * MAP_HEIGHT - centroid.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0) / pts.length;
  return Math.max(28, mean * 0.6);
}

/** Invisible tap target for "empty ground inside a region" — opens
 *  RegionSheet. Sits underneath the city-pin TouchableOpacitys in render
 *  order, so a tap landing on a city pin is claimed by that pin first (RN's
 *  default overlapping-touch resolution favours the later-rendered/topmost
 *  view); only a tap that misses every pin falls through to this. */
function RegionTapTarget({ region, onPress }: { region: (typeof REGIONS)[number]; onPress: () => void }) {
  const centroid = regionCentroidPx(region);
  const radius = regionTapRadiusPx(region, centroid);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      style={{
        position: 'absolute',
        left: centroid.x - radius,
        top: centroid.y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
      }}
    />
  );
}

function RegionLabel({ region }: { region: (typeof REGIONS)[number] }) {
  const centroid = regionCentroidPx(region);
  return (
    <View pointerEvents="none" style={[styles.regionLabelWrap, { left: centroid.x - 60, top: centroid.y - 8 }]}>
      <Text style={styles.regionLabelText}>{region.name.toUpperCase()}</Text>
    </View>
  );
}

/** One marker per region that currently has ≥1 army — positioned at the
 *  first such army's stationed city (per Chunk C1's movement-model note:
 *  the army's specific city within its region is flavor-only, but a good
 *  anchor for exactly this kind of marker), falling back to the region's
 *  centroid if that city isn't found on the map for some reason. Tapping it
 *  opens RegionSheet focused on that army — a region with several armies
 *  still shows all of them there, this marker just jumps straight to one. */
function ArmyMarker({ army, onPress }: { army: Army; onPress: () => void }) {
  const region = REGIONS.find(r => r.id === army.location);
  const cityDef = army.stationedCityId ? ALL_CITIES.find(c => c.id === army.stationedCityId) : null;
  const pos = cityDef
    ? { x: cityDef.nodeX * MAP_WIDTH, y: cityDef.nodeY * MAP_HEIGHT }
    : region
    ? regionCentroidPx(region)
    : { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.armyMarker, { left: pos.x - 12, top: pos.y - 34 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.armyMarkerIcon}>⚔</Text>
    </TouchableOpacity>
  );
}

/** Chunk C5 — one reachability highlight, replacing the normal region tap
 *  target for the duration of order mode. Colour keys off intent (gold
 *  move / crimson attack); a blocked destination (leaderless-attack) is
 *  shown dimmed and untappable rather than hidden, so the player can see
 *  WHY it's off-limits (ArmyCard/the order banner spells out the reason in
 *  words — this is just the visual echo of the same reachable() result). */
function OrderHighlight({
  region,
  destination,
  onPress,
}: {
  region: (typeof REGIONS)[number];
  destination: ReachableDestination;
  onPress: () => void;
}) {
  const centroid = regionCentroidPx(region);
  const blocked = !!destination.blockedReason;
  const color = blocked ? COLORS.dust : destination.intent === 'attack' ? COLORS.crimson : COLORS.laurel;
  return (
    <TouchableOpacity
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      activeOpacity={0.7}
      style={[
        styles.orderHighlight,
        { left: centroid.x - 24, top: centroid.y - 24, borderColor: color, opacity: blocked ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.orderHighlightText, { color }]}>
        {destination.viaSeaLane ? '⛵' : destination.intent === 'attack' ? '⚔' : '→'}{destination.costSpent}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MapViewProps {
  provinces: CityState[];
  onProvincePress: (provinceId: string) => void;
  selectedProvinceId: string | null;
  armies: Army[];
  onRegionPress: (regionId: RegionId, focusArmyId?: string) => void;
  /** Chunk C5 — when set, replaces the normal region-tap layer with
   *  reachability highlights for the army being ordered; tapping one calls
   *  onOrderRegionPress instead of onRegionPress. */
  orderModeDestinations?: ReachableDestination[] | null;
  onOrderRegionPress?: (regionId: RegionId) => void;
  /** Chunk C7 — when set, takes over the whole component as its own render
   *  branch (not interleaved with the interactive tap/order-mode layers
   *  above): replays the season's CampaignLog as an animated sequence over
   *  the same region/city base layers. `armies` is still the FINAL
   *  (post-resolution) list — playback derives each army's start-of-season
   *  position from the log itself (see computePlaybackStartPositions) and
   *  animates toward the positions `armies` already reflects. */
  playbackLog?: CampaignLog | null;
  onPlaybackComplete?: () => void;
}

/** Every army's position before this season's moves — derived from the log
 *  rather than passed in, since campaignResolver only returns the FINAL
 *  armies array. An army with no move/withdrawal entry this season (never
 *  ordered, or its order bounced on the first step) just sits at its
 *  current (== starting) location the whole time. A shattered army (no
 *  longer in `armies` at all) has no entry here — its loss is narrated by
 *  its own log entry's banner text, not a fading token (v1 scope cut). */
function computePlaybackStartPositions(entries: CampaignLogEntry[], armies: Army[]): Record<string, RegionId> {
  const positions: Record<string, RegionId> = {};
  for (const army of armies) {
    const firstMove = entries.find(
      (e): e is Extract<CampaignLogEntry, { type: 'move' | 'withdrawal' }> =>
        (e.type === 'move' || e.type === 'withdrawal') && e.armyId === army.id
    );
    positions[army.id] = firstMove ? firstMove.from : army.location;
  }
  return positions;
}

const PLAYBACK_STEP_MS = 600;
const PLAYBACK_BANNER_MS = 900;

/** One moving token, one banner line at a time — "staggered, not
 *  simultaneous" (the plan's own wording). Tap anywhere to skip straight to
 *  final positions (non-negotiable per the plan). */
function PlaybackLayer({
  log,
  armies,
  onComplete,
}: {
  log: CampaignLog;
  armies: Army[];
  onComplete: () => void;
}) {
  const [entryIndex, setEntryIndex] = useState(0);
  const [positions, setPositions] = useState<Record<string, RegionId>>(() =>
    computePlaybackStartPositions(log.entries, armies)
  );
  const [movingArmyId, setMovingArmyId] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const slideAnim = useRef(new Animated.ValueXY()).current;
  // A ref alongside the `skipped` state: async animation/timer callbacks
  // check this synchronously (state updates aren't visible inside a
  // callback closed over before the update) to avoid acting after a skip.
  const skippedRef = useRef(false);

  useEffect(() => {
    if (skippedRef.current) return;
    if (entryIndex >= log.entries.length) {
      onComplete();
      return;
    }
    const entry = log.entries[entryIndex];

    if (entry.type === 'move' || entry.type === 'withdrawal') {
      const fromRegion = REGIONS.find(r => r.id === entry.from);
      const toRegion = REGIONS.find(r => r.id === entry.to);
      if (fromRegion && toRegion) {
        const fromPos = regionCentroidPx(fromRegion);
        const toPos = regionCentroidPx(toRegion);
        setMovingArmyId(entry.armyId);
        slideAnim.setValue(fromPos);
        const anim = Animated.timing(slideAnim, {
          toValue: toPos,
          duration: PLAYBACK_STEP_MS,
          useNativeDriver: false,
        });
        anim.start(({ finished }) => {
          if (!finished || skippedRef.current) return;
          setPositions(p => ({ ...p, [entry.armyId]: entry.to }));
          setMovingArmyId(null);
          setEntryIndex(i => i + 1);
        });
        return () => anim.stop();
      }
    }

    setBannerText(entry.text);
    const t = setTimeout(() => {
      if (skippedRef.current) return;
      setBannerText(null);
      setEntryIndex(i => i + 1);
    }, PLAYBACK_BANNER_MS);
    return () => clearTimeout(t);
  }, [entryIndex]);

  function skipToEnd() {
    skippedRef.current = true;
    setSkipped(true);
    setMovingArmyId(null);
    setBannerText(null);
    onComplete();
  }

  const finalPositions: Record<string, RegionId> = {};
  for (const a of armies) finalPositions[a.id] = a.location;
  const displayPositions = skipped ? finalPositions : positions;

  return (
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      activeOpacity={1}
      onPress={skipToEnd}
    >
      {REGIONS.map(region => {
        const armiesHere = armies.filter(a => displayPositions[a.id] === region.id && a.id !== movingArmyId);
        if (armiesHere.length === 0) return null;
        const pos = regionCentroidPx(region);
        return (
          <View key={region.id} pointerEvents="none" style={[styles.armyMarker, { left: pos.x - 12, top: pos.y - 34 }]}>
            <Text style={styles.armyMarkerIcon}>⚔</Text>
          </View>
        );
      })}

      {movingArmyId && !skipped && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.armyMarker,
            { left: Animated.subtract(slideAnim.x, 12), top: Animated.subtract(slideAnim.y, 34) },
          ]}
        >
          <Text style={styles.armyMarkerIcon}>⚔</Text>
        </Animated.View>
      )}

      {bannerText && !skipped && (
        <View style={styles.playbackBanner} pointerEvents="none">
          <Text style={styles.playbackBannerText}>{bannerText}</Text>
        </View>
      )}

      {!skipped && (
        <View style={styles.playbackSkipHint} pointerEvents="none">
          <Text style={styles.playbackSkipHintText}>Tap to skip</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MapView({
  provinces,
  onProvincePress,
  selectedProvinceId,
  armies,
  onRegionPress,
  orderModeDestinations,
  onOrderRegionPress,
  playbackLog,
  onPlaybackComplete,
}: MapViewProps) {
  return (
    <View style={styles.container}>
      {/* Parchment background fills the transparent border areas in the PNG */}
      <View style={styles.parchmentBg} />

      <Image
        source={require('../../assets/images/italy-mosaic.png')}
        style={styles.mapImage as ImageStyle}
        resizeMode="stretch"
      />

      {REGIONS.map(region => (
        <RegionBorderOutline key={region.id} regionId={region.id} />
      ))}

      {playbackLog ? (
        <PlaybackLayer log={playbackLog} armies={armies} onComplete={() => onPlaybackComplete?.()} />
      ) : orderModeDestinations
        ? orderModeDestinations.map(dest => {
            const region = REGIONS.find(r => r.id === dest.regionId);
            if (!region) return null;
            return (
              <OrderHighlight
                key={dest.regionId}
                region={region}
                destination={dest}
                onPress={() => onOrderRegionPress?.(dest.regionId)}
              />
            );
          })
        : REGIONS.map(region => (
            <RegionTapTarget key={region.id} region={region} onPress={() => onRegionPress(region.id)} />
          ))}

      {REGIONS.map(region => (
        <RegionLabel key={region.id} region={region} />
      ))}

      {ALL_CITIES.map(def => {
        const province = provinces.find(p => p.id === def.id);
        if (!province) return null;

        // nodeX and nodeY are fractions of the full rendered image (MAP_WIDTH × MAP_HEIGHT)
        const left = def.nodeX * MAP_WIDTH  - NODE_SIZE / 2;
        const top  = def.nodeY * MAP_HEIGHT - NODE_SIZE / 2;

        const { fill, border } = getNodeColour(province, def);
        const isSelected  = selectedProvinceId === def.id;
        const isHeartland = def.status === 'heartland';

        return (
          <TouchableOpacity
            key={def.id}
            onPress={() => onProvincePress(def.id)}
            style={[styles.nodeWrapper, { left, top }]}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {province.ownedAssets.length > 0 && !isHeartland && (
              <View style={[styles.assetRing, { borderColor: COLORS.denariiColor }]} />
            )}

            <View
              style={[
                styles.node,
                {
                  backgroundColor: fill,
                  borderColor:  isSelected ? '#ffffff' : border,
                  borderWidth:  isSelected ? 3 : 2,
                  shadowColor:  province.revoltActive ? '#cc2222' : fill,
                  shadowOpacity: province.revoltActive ? 0.9 : 0.6,
                  shadowRadius:  province.revoltActive ? 10 : 5,
                  elevation:     isSelected ? 10 : 5,
                },
              ]}
            >
              {province.revoltActive && <Text style={styles.nodeIcon}>⚔</Text>}
              {(province.playerGovernor || province.playerAmbassador) && !province.revoltActive && (
                <Text style={styles.nodeIcon}>★</Text>
              )}
            </View>

            <View style={styles.labelContainer}>
              <Text
                style={[
                  styles.nodeLabel,
                  isSelected  && styles.nodeLabelSelected,
                  isHeartland && styles.nodeLabelHeartland,
                ]}
                numberOfLines={2}
              >
                {def.name.toUpperCase()}
              </Text>
              {!isHeartland && (
                <Text style={[styles.relPill, { color: getRelPillColour(province.relationshipScore) }]}>
                  {Math.round(province.relationshipScore)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* One marker per region that has ≥1 army — RegionSheet lists every
          army there regardless of which one the marker happens to focus.
          Suppressed during playback: PlaybackLayer renders its own markers
          off mid-season positions, not the final ones this base layer reads. */}
      {!playbackLog && REGIONS.map(region => {
        const first = armies.find(a => a.location === region.id);
        if (!first) return null;
        return (
          <ArmyMarker
            key={region.id}
            army={first}
            onPress={() => onRegionPress(region.id, first.id)}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width:    MAP_WIDTH,
    height:   MAP_HEIGHT,
    position: 'relative',
  } as ViewStyle,

  parchmentBg: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#c8a86a',
  } as ViewStyle,

  mapImage: {
    position: 'absolute',
    top:    0,
    left:   0,
    width:  MAP_WIDTH,
    height: MAP_HEIGHT,
  } as ImageStyle,

  nodeWrapper: {
    position: 'absolute',
    width:    NODE_SIZE,
    height:   NODE_SIZE,
    alignItems: 'center',
  } as ViewStyle,

  assetRing: {
    position:     'absolute',
    width:        NODE_SIZE + 10,
    height:       NODE_SIZE + 10,
    borderRadius: (NODE_SIZE + 10) / 2,
    borderWidth:  2,
    top:  -5,
    left: -5,
  } as ViewStyle,

  node: {
    width:        NODE_SIZE,
    height:       NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems:   'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
  } as ViewStyle,

  nodeIcon: {
    fontSize:   12,
    color:      '#fff',
    lineHeight: 14,
  } as TextStyle,

  labelContainer: {
    position: 'absolute',
    top:   NODE_SIZE + 3,
    left:  -34,
    width: NODE_SIZE + 68,
    alignItems: 'center',
  } as ViewStyle,

  nodeLabel: {
    color:      '#fff',
    fontFamily: FONTS.ui,
    fontSize:   8,
    letterSpacing: 0.5,
    textAlign:  'center',
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontWeight: '700',
  } as TextStyle,

  nodeLabelSelected: {
    color: COLORS.gold,
  } as TextStyle,

  nodeLabelHeartland: {
    color:    COLORS.gold,
    fontSize: 9,
  } as TextStyle,

  relPill: {
    fontFamily:  FONTS.ui,
    fontSize:    8,
    marginTop:   1,
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontWeight:  '700',
  } as TextStyle,

  regionLabelWrap: {
    position: 'absolute',
    width: 120,
    alignItems: 'center',
  } as ViewStyle,

  regionLabelText: {
    color: 'rgba(240,235,224,0.8)',
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontWeight: '700',
  } as TextStyle,

  armyMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4a1414',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  } as ViewStyle,

  armyMarkerIcon: {
    fontSize: 12,
    color: COLORS.gold,
  } as TextStyle,

  orderHighlight: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    backgroundColor: 'rgba(20,16,10,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  orderHighlightText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,

  playbackBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: 'rgba(20,16,10,0.9)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  } as ViewStyle,
  playbackBannerText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
    textAlign: 'center',
  } as TextStyle,

  playbackSkipHint: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(20,16,10,0.75)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  } as ViewStyle,
  playbackSkipHintText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
  } as TextStyle,
});
