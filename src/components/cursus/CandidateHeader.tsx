// ─── CandidateHeader ─────────────────────────────────────────────────────────
// Chunk C2 of cursus-visual-redesign-plan.md — replaces CursusScreen.tsx's
// "VIEWING [chips]" row (FamilyMemberPicker) with the mockup's candidate
// header card: portrait, name, candidacy/office line, age, skill meters, and
// prev/next arrows cycling eligible family members.
//
// Selection stays local screen state (Finding 3 — CursusScreen owns
// selectedCharId via useState, same as the FamilyMemberPicker it replaces);
// this component takes selected/onSelect as props, it doesn't read/write a
// store field.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { OFFICES } from '../../data/offices';
import type { Character } from '../../models/character';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import GildedPanel from '../shared/GildedPanel';
import PortraitRoundel from '../shared/PortraitRoundel';
import SkillMeter from '../shared/SkillMeter';
import type { PortraitSubject } from '../../engine/portraitEngine';

interface CandidateHeaderProps {
  selected: string;
  onSelect: (id: string) => void;
}

function subjectFor(c: Character): PortraitSubject {
  return { kind: 'character', id: c.id, name: c.name, role: c.role, age: c.age };
}

/** True household-wide officeholder check (Finding: `character.officeId` is
 *  documented dead for non-player family members — see character.ts's own
 *  comment on that field — only `GameState.currentOffice` +
 *  `campaigningCharacterId` reliably identify who currently holds the
 *  single household office slot, for player and family wins alike). */
function contextLineFor(
  character: Character,
  campaigning: string | null,
  campaigningCharacterId: string | null,
  currentOffice: string | null,
  officeSeasons: number,
): string {
  const isCandidate = campaigning !== null && campaigningCharacterId === character.id;
  if (isCandidate) {
    const office = OFFICES.find(o => o.id === campaigning);
    return `Candidate: ${office?.name ?? campaigning}`;
  }
  const isHolder = currentOffice !== null && campaigningCharacterId === character.id;
  if (isHolder) {
    const office = OFFICES.find(o => o.id === currentOffice);
    return `Holds: ${office?.name ?? currentOffice} (${officeSeasons} season${officeSeasons !== 1 ? 's' : ''} left)`;
  }
  return 'Privatus';
}

export default function CandidateHeader({ selected, onSelect }: CandidateHeaderProps) {
  const family = useGameStore(s => s.family);
  const campaigning = useGameStore(s => s.campaigning);
  const campaigningCharacterId = useGameStore(s => s.campaigningCharacterId);
  const currentOffice = useGameStore(s => s.currentOffice);
  const officeSeasons = useGameStore(s => s.officeSeasons);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isCandidate = (c: Character) => campaigning !== null && campaigningCharacterId === c.id;
  const isHolder = (c: Character) => currentOffice !== null && campaigningCharacterId === c.id;

  // Sorted: current campaigners first, then office-holders, then by age desc.
  const eligible = family
    .filter(c => c.age >= 18)
    .slice()
    .sort((a, b) => {
      const rank = (c: Character) => isCandidate(c) ? 0 : isHolder(c) ? 1 : 2;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return b.age - a.age;
    });

  if (eligible.length === 0) return null;

  const index = Math.max(0, eligible.findIndex(c => c.id === selected));
  const character = eligible[index];
  const nextChar = eligible[(index + 1) % eligible.length];

  function goPrev() {
    onSelect(eligible[(index - 1 + eligible.length) % eligible.length].id);
  }
  function goNext() {
    onSelect(eligible[(index + 1) % eligible.length].id);
  }

  const contextLine = contextLineFor(character, campaigning, campaigningCharacterId, currentOffice, officeSeasons);

  return (
    <View style={styles.wrapper}>
      <GildedPanel style={styles.panel}>
        <View style={styles.row}>
          <TouchableOpacity onPress={goPrev} style={styles.arrowBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Text style={styles.arrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.main}>
            <View style={styles.identityRow}>
              <PortraitRoundel subject={subjectFor(character)} size={56} frame="gold" />
              <View style={styles.textBlock}>
                <TouchableOpacity onPress={() => setPickerOpen(true)}>
                  <Text style={styles.name} numberOfLines={1}>
                    {character.isPlayer ? '⭐ ' : ''}{character.name}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.context} numberOfLines={1}>{contextLine}</Text>
                <Text style={styles.age}>Age: {character.age}</Text>
              </View>
            </View>

            <View style={styles.skillsRow}>
              <SkillMeter label="RHE" value={character.skills.rhetoric} color={COLORS.gold} glossaryTermId="rhetoric" />
              <SkillMeter label="MAR" value={character.skills.martial} color={COLORS.crimson} glossaryTermId="martial" />
              <SkillMeter label="INT" value={character.skills.intrigus} color={COLORS.senateBlue} glossaryTermId="intrigus" />
            </View>
          </View>

          <TouchableOpacity onPress={goNext} style={styles.peek} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            {eligible.length > 1 && (
              <>
                <PortraitRoundel subject={subjectFor(nextChar)} size={32} frame="plain" />
                <Text style={styles.peekName} numberOfLines={1}>{nextChar.name.split(' ')[0]}</Text>
              </>
            )}
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>
      </GildedPanel>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={pk.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={pk.sheet} onPress={() => {}}>
            <Text style={pk.title}>VIEWING CANDIDATE</Text>
            <ScrollView style={pk.list}>
              {eligible.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[pk.row, c.id === selected && pk.rowActive]}
                  onPress={() => { onSelect(c.id); setPickerOpen(false); }}
                >
                  <PortraitRoundel subject={subjectFor(c)} size={36} frame={c.id === selected ? 'gold' : 'plain'} />
                  <View style={pk.rowText}>
                    <Text style={pk.rowName}>{c.isPlayer ? '⭐ ' : ''}{c.name}</Text>
                    <Text style={pk.rowSub}>
                      {contextLineFor(c, campaigning, campaigningCharacterId, currentOffice, officeSeasons)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  panel: {
    padding: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtn: {
    paddingHorizontal: SPACING.xs,
  },
  arrow: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 26,
  },
  main: {
    flex: 1,
    marginHorizontal: SPACING.xs,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  name: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  context: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 2,
  },
  age: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 1,
  },
  skillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  peek: {
    alignItems: 'center',
    width: 56,
  },
  peekName: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    marginTop: 2,
    maxWidth: 56,
  },
});

const pk = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.gildFrame,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    maxHeight: '70%',
  },
  title: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  rowActive: {
    backgroundColor: 'rgba(200,168,112,0.12)',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
  },
  rowSub: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  },
});
