import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { HOUSE_LOCATION_DEFINITIONS, getHouseLocationDefinition } from '../../data/houseLocations';
import { getHouseRoomDefinition } from '../../data/houseRooms';
import { HOUSE_BUSINESS_DEFINITIONS, getHouseBusinessDefinition } from '../../data/houseBusinesses';
import { getAvailableRooms } from '../../engine/houseEngine';
import type { RoomDefinition, BusinessDefinition, HouseLocationDefinition } from '../../models/house';
import HousePickerModal, { type HousePickerItem } from './HousePickerModal';
import RelocateModal from './RelocateModal';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import InfoTap from '../shared/InfoTap';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Bonus summary formatting ─────────────────────────────────────────────────

function roomBonusSummary(room: RoomDefinition): string {
  const parts: string[] = [];
  if (room.bonus.trainingRollBonus) parts.push(`+${Math.round(room.bonus.trainingRollBonus * 100)}% training success chance`);
  if (room.bonus.clientSlotBonus) parts.push(`+${room.bonus.clientSlotBonus} client slots`);
  if (room.bonus.dinnerRelationshipMult) parts.push(`×${room.bonus.dinnerRelationshipMult} dinner-invite relationship gain`);
  if (room.bonus.fidesPerSeason) parts.push(`+${room.bonus.fidesPerSeason} Fides/season`);
  if (room.bonus.rhetoricGrant) parts.push(`+${room.bonus.rhetoricGrant} Rhetoric (permanent, one-time)`);
  return parts.join(' · ');
}

function businessBonusSummary(business: BusinessDefinition): string {
  const parts: string[] = [];
  if (business.bonus.gold) parts.push(`+${business.bonus.gold} Denarii/season`);
  if (business.bonus.fides) parts.push(`+${business.bonus.fides} Fides/season`);
  if (business.bonus.corruptionShield) parts.push(`-${business.bonus.corruptionShield} corruption gain/season`);
  return parts.join(' · ');
}

const PRESTIGE_LABEL: Record<string, string> = { low: 'LOW PRESTIGE', mid: 'MID PRESTIGE', high: 'HIGH PRESTIGE' };

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function FamilyHousePanel() {
  const house = useGameStore(s => s.house);
  const denarii = useGameStore(s => s.denarii);
  const buildRoom = useGameStore(s => s.buildRoom);
  const rentShop = useGameStore(s => s.rentShop);
  const vacateShop = useGameStore(s => s.vacateShop);
  const buyHouse = useGameStore(s => s.buyHouse);

  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [shopPickerSlot, setShopPickerSlot] = useState<number | null>(null);
  const [relocateTarget, setRelocateTarget] = useState<HouseLocationDefinition | null>(null);

  const location = getHouseLocationDefinition(house.locationId);
  if (!location) return null; // defensive — should never happen, house.locationId always a valid id

  const roomItems: HousePickerItem[] = getAvailableRooms(house).map(r => ({
    id: r.type, name: r.name, cost: r.cost, flavorText: r.flavorText, bonusSummary: roomBonusSummary(r),
  }));
  const businessItems: HousePickerItem[] = HOUSE_BUSINESS_DEFINITIONS.map(b => ({
    id: b.type, name: b.name, cost: b.cost, flavorText: b.flavorText, bonusSummary: businessBonusSummary(b),
  }));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <InfoTap termId="family-house">
          <Text style={styles.panelHeader}>FAMILY HOUSE</Text>
        </InfoTap>

        {/* Current house */}
        <ParchmentCard>
          <Text style={styles.houseName}>{location.name} <Text style={styles.houseLatin}>({location.latinName})</Text></Text>
          <Text style={styles.prestige}>{PRESTIGE_LABEL[location.prestige]}{location.biasAlignment ? ` · ${location.biasAlignment.toUpperCase()} LEANING` : ''}</Text>
          <Text style={styles.flavor}>{location.flavorText}</Text>
          {location.locationBonus.dignitasPerSeason ? (
            <Text style={styles.locationBonus}>+{location.locationBonus.dignitasPerSeason} Dignitas/season</Text>
          ) : null}
          {location.locationBonus.factionRelPerSeason ? (
            <Text style={styles.locationBonus}>+{location.locationBonus.factionRelPerSeason} relationship/season with {location.biasAlignment} leaders</Text>
          ) : null}
        </ParchmentCard>

        {/* Rooms */}
        <Text style={styles.sectionLabel}>ROOMS — {house.builtRooms.length}/{location.roomSlots}</Text>
        {Array.from({ length: location.roomSlots }).map((_, i) => {
          const roomType = house.builtRooms[i];
          const room = roomType ? getHouseRoomDefinition(roomType) : undefined;
          return room ? (
            <ParchmentCard key={i}>
              <Text style={styles.slotName}>{room.name}</Text>
              <Text style={styles.flavor}>{room.flavorText}</Text>
              <Text style={styles.locationBonus}>{roomBonusSummary(room)}</Text>
            </ParchmentCard>
          ) : (
            <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => setRoomPickerOpen(true)}>
              <ParchmentCard>
                <Text style={styles.emptySlot}>+ Build a room</Text>
              </ParchmentCard>
            </TouchableOpacity>
          );
        })}

        {/* Storefronts — Palatine has 0 shopSlots, so this section is absent there */}
        {location.shopSlots > 0 && (
          <>
            <InfoTap termId="storefront">
              <Text style={styles.sectionLabel}>
                STOREFRONTS — {house.shops.filter(s => s !== null).length}/{location.shopSlots}
              </Text>
            </InfoTap>
            {house.shops.map((businessType, i) => {
              const business = businessType ? getHouseBusinessDefinition(businessType) : undefined;
              return business ? (
                <ParchmentCard key={i}>
                  <Text style={styles.slotName}>{business.name}</Text>
                  <Text style={styles.flavor}>{business.flavorText}</Text>
                  <Text style={styles.locationBonus}>{businessBonusSummary(business)}</Text>
                  <TouchableOpacity style={styles.vacateBtn} onPress={() => vacateShop(i)}>
                    <Text style={styles.vacateBtnText}>Vacate</Text>
                  </TouchableOpacity>
                </ParchmentCard>
              ) : (
                <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => setShopPickerSlot(i)}>
                  <ParchmentCard>
                    <Text style={styles.emptySlot}>+ Rent this storefront</Text>
                  </ParchmentCard>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Relocate */}
        <Text style={styles.sectionLabel}>RELOCATE</Text>
        {HOUSE_LOCATION_DEFINITIONS.filter(l => l.id !== house.locationId).map(loc => (
          <TouchableOpacity key={loc.id} activeOpacity={0.75} onPress={() => setRelocateTarget(loc)}>
            <ParchmentCard>
              <Text style={styles.houseName}>{loc.name} <Text style={styles.houseLatin}>({loc.latinName})</Text></Text>
              <Text style={styles.prestige}>{PRESTIGE_LABEL[loc.prestige]} · {loc.roomSlots} rooms · {loc.shopSlots} shops</Text>
              <Text style={styles.flavor} numberOfLines={2}>{loc.flavorText}</Text>
              <Text style={[styles.cost, denarii < loc.cost && styles.costDisabled]}>{loc.cost} Denarii</Text>
            </ParchmentCard>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {roomPickerOpen && (
        <HousePickerModal
          title="Build a Room"
          subtitle={`${location.roomSlots - house.builtRooms.length} slot(s) remaining`}
          items={roomItems}
          onPick={(type) => { buildRoom(type as any); setRoomPickerOpen(false); }}
          onClose={() => setRoomPickerOpen(false)}
        />
      )}
      {shopPickerSlot !== null && (
        <HousePickerModal
          title="Rent a Storefront"
          items={businessItems}
          onPick={(type) => { rentShop(shopPickerSlot, type as any); setShopPickerSlot(null); }}
          onClose={() => setShopPickerSlot(null)}
        />
      )}
      {relocateTarget && (
        <RelocateModal
          location={relocateTarget}
          currentHouse={house}
          onConfirm={() => { buyHouse(relocateTarget.id); setRelocateTarget(null); }}
          onClose={() => setRelocateTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  panelHeader: {
    color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 8,
    textTransform: 'uppercase', marginBottom: SPACING.lg,
  },
  sectionLabel: {
    color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.md,
  },
  houseName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 17, fontWeight: '700' },
  houseLatin: { fontStyle: 'italic', fontWeight: '400', fontSize: 14, color: PARCHMENT_TEXT.muted },
  prestige: { color: PARCHMENT_TEXT.gold, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1, marginTop: 2 },
  flavor: {
    color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12,
    lineHeight: 17, marginTop: SPACING.xs,
  },
  locationBonus: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 11, marginTop: SPACING.xs },
  slotName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  emptySlot: {
    color: PARCHMENT_TEXT.gold, fontFamily: FONTS.ui, fontSize: 13, fontWeight: '700', textAlign: 'center',
  },
  vacateBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  vacateBtnText: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700' },
  cost: { color: PARCHMENT_TEXT.gold, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', marginTop: SPACING.xs },
  costDisabled: { color: PARCHMENT_TEXT.muted },
});
