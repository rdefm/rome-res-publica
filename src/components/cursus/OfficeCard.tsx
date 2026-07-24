// ─── OfficeCard ──────────────────────────────────────────────────────────────
// Chunk C4 of cursus-visual-redesign-plan.md — replaces CursusScreen.tsx's
// inline OfficeRung. Per-character status (served/held/active/eligible/
// locked) via engine/officeStatus.ts, a StatusSeal, and a whole-card tap that
// opens OfficeActionsModal (design decision: there is no separate action
// panel elsewhere to "scroll to" — in-office actions have always rendered
// inline in this same card, so the card itself is the shortcut's
// destination). The Apply/Campaign button stays its own nested tap target,
// unaffected by the card-wide tap (RN's touch responder system resolves the
// innermost pressed Touchable, not both).
//
// Co-consul indicator and Tribune-immunity badge are pre-existing content
// carried over unchanged from OfficeRung — not part of this chunk's own
// scope, just preserved.

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { Character } from '../../models/character';
import type { OfficeId } from '../../models/office';
import { OFFICES } from '../../data/offices';
import { getOfficeStatus } from '../../engine/officeStatus';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import StatusSeal from '../shared/StatusSeal';
import InfoTap from '../shared/InfoTap';
import { cursusAssets } from '../../utils/cursusAssets';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import OfficeActionsModal from './OfficeActionsModal';

function OfficeCard({
  officeId,
  character,
}: {
  officeId: OfficeId;
  character: Character;
}) {
  // Chunk C5 — field-level selectors instead of an unselected useGameStore()
  // call (CLAUDE.md's selector-discipline rule), so an unrelated store write
  // elsewhere in the app doesn't re-render every office card on screen.
  const currentOffice = useGameStore(s => s.currentOffice);
  const heldOffices = useGameStore(s => s.heldOffices);
  const campaigning = useGameStore(s => s.campaigning);
  const campaigningCharacterId = useGameStore(s => s.campaigningCharacterId);
  const declareCampaign = useGameStore(s => s.declareCampaign);
  const declareFamilyCampaign = useGameStore(s => s.declareFamilyCampaign);
  const npcConsul = useGameStore(s => s.npcConsul);
  const tribuneHolder = useGameStore(s => s.tribuneHolder);
  const clans = useGameStore(s => s.clans);
  const [modalOpen, setModalOpen] = useState(false);

  const office = OFFICES.find((o) => o.id === officeId)!;
  const isPlayer = character.isPlayer;

  const { status, reason } = getOfficeStatus(character, office, {
    currentOffice, heldOffices, campaigning, campaigningCharacterId,
  });

  const showApplyBtn = status === 'eligible' || status === 'locked';
  const canApply = status === 'eligible';

  function handleDeclare() {
    if (isPlayer) declareCampaign(officeId);
    else declareFamilyCampaign(character.id, officeId);
  }

  // Co-consul indicator: shown inside the Consul card when player holds it
  const showCoConsul = officeId === 'consul' && status === 'held' && isPlayer && npcConsul;
  const npcConsulName = npcConsul
    ? (clans.find((c) => c.id === npcConsul.clanId)
        ?.leaders?.find((l) => l.id === npcConsul.leaderId)?.name
        ?? 'Unknown')
    : '';
  const npcConsulClan = npcConsul
    ? (clans.find((c) => c.id === npcConsul.clanId)?.name ?? npcConsul.clanId)
    : '';
  const antagonismLabels = ['cooperative', 'mildly opposed', 'actively hostile', 'openly antagonistic'];

  const officeIconImg = cursusAssets.officeIcon(officeId);

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setModalOpen(true)}>
        <ParchmentCard style={rung.container} contentStyle={rung.inner}>
          {/* Chunk E follow-up — icon now spans the card's full height (not
              just the top name/latin/meta row) via alignItems: 'stretch' on
              cardRow, per user feedback that the icon should own "the whole
              left side" of the card, not just a slot within its top row. */}
          <View style={rung.cardRow}>
            <View style={rung.iconSlot}>
              {officeIconImg ? (
                <Image source={officeIconImg} style={rung.iconImg} resizeMode="contain" />
              ) : (
                <Text style={rung.icon}>{office.icon}</Text>
              )}
            </View>

            <View style={rung.rightCol}>
              <View style={rung.row}>
                <View style={rung.info}>
                  <InfoTap termId={officeId}>
                    <Text style={rung.name}>{office.name}</Text>
                  </InfoTap>
                  <Text style={rung.latin}>{office.latin}</Text>
                  <Text style={rung.meta}>Min age {office.minAge} · {office.termSeasons} seasons</Text>
                </View>
                {showApplyBtn && (
                  <TouchableOpacity
                    style={[rung.applyBtn, !canApply && rung.applyBtnLocked]}
                    onPress={handleDeclare}
                    disabled={!canApply}
                  >
                    <Text style={[rung.applyText, !canApply && rung.applyTextLocked]}>CAMPAIGN</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={rung.desc}>{office.desc}</Text>

              {/* Chunk F of cursustabuifixesplan.md — tapHint always renders
                  first (left slot); StatusSeal always renders second (right
                  slot, under the CAMPAIGN button above). 'eligible' status
                  still renders no chip (StatusSeal returns null), so tapHint
                  stays alone on the left exactly as before for that case. */}
              <View style={rung.sealRow}>
                <Text style={rung.tapHint}>Tap for powers ›</Text>
                <StatusSeal status={status} reason={reason} />
              </View>

              {/* Co-consul indicator (Consul office only) */}
              {showCoConsul && (
                <View style={rung.coConsul}>
                  <Text style={rung.coConsulLabel}>CO-CONSUL</Text>
                  <Text style={rung.coConsulName}>
                    {npcConsulName} ({npcConsulClan})
                  </Text>
                  <Text style={[
                    rung.coConsulAntagonism,
                    npcConsul.antagonismLevel >= 2 && rung.coConsulHostile,
                  ]}>
                    Antagonism: {npcConsul.antagonismLevel}/3
                    {' — '}{antagonismLabels[npcConsul.antagonismLevel]}
                  </Text>
                </View>
              )}

              {/* Tribune immunity indicator when this character holds Tribune */}
              {character.id === tribuneHolder && (
                <View style={rung.immunityBadge}>
                  <Text style={rung.immunityText}>🛡 Sacrosanct — trial immunity active</Text>
                </View>
              )}
            </View>
          </View>
        </ParchmentCard>
      </TouchableOpacity>

      <OfficeActionsModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        office={office}
        character={character}
        status={status}
      />
    </>
  );
}

// Chunk C5 — memoized on (officeId, character) shallow-equality: skips a
// re-render when a parent re-render is triggered by an unrelated store
// write, since gameStore's family-update sites (`family.map(c => c.id ===
// x ? {...} : c)`) keep every OTHER character's object reference stable.
export default React.memo(OfficeCard);

const rung = StyleSheet.create({
  container: { marginBottom: SPACING.sm },
  // Chunk E follow-up — icon slot is a sibling of rightCol (name/latin/meta,
  // desc, sealRow, co-consul/immunity badges), not nested inside the top
  // row alongside them, so alignItems: 'stretch' makes it span the card's
  // full height rather than just the height of the name/latin/meta row.
  cardRow: { flexDirection: 'row', alignItems: 'stretch' },
  rightCol: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  // Width is a fraction of the card (not a fixed px box) so the icon fills
  // a genuinely large chunk of the card's left side per user feedback; no
  // aspectRatio here (unlike the first pass at this) since height now comes
  // from cardRow's stretch, not a fixed square — resizeMode="contain" on
  // the real icon assets keeps them from distorting inside a non-square
  // box regardless. The old marginLeft nudge on iconImg (bumped 28->44 per
  // earlier user feedback, then nudged right to compensate for the card's
  // near-zero content padding) is gone now that Chunk B gave the card real
  // edge padding — keeping both would have overcorrected.
  iconSlot: { width: '32%', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  icon: { fontSize: 64 },
  iconImg: { width: '100%', height: '100%' },
  info: { flex: 1 },
  inner: { padding: SPACING.sm },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  latin: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11 },
  meta: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  applyBtn: { backgroundColor: COLORS.amber + '22', borderWidth: 1, borderColor: COLORS.amber, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  // Chunk F of cursustabuifixesplan.md — a genuinely distinct locked look
  // (same border/lockedText tokens StatusSeal's own LOCKED chip uses, so the
  // two locked indicators read as the same visual language), not just a
  // dimmed copy of the active gold button (opacity: 0.4 read as "still
  // tappable, just faint" rather than "locked").
  applyBtnLocked: { backgroundColor: COLORS.border + '22', borderColor: COLORS.lockedText, opacity: 1 },
  applyText: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 12, fontWeight: '700' },
  applyTextLocked: { color: COLORS.lockedText },
  sealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  tapHint: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.3, opacity: 0.8 },
  coConsul: { marginTop: SPACING.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: 'rgba(200,168,112,0.08)' },
  coConsulLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  coConsulName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  coConsulAntagonism: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  coConsulHostile: { color: COLORS.crimson },
  immunityBadge: { marginTop: SPACING.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5, backgroundColor: 'rgba(80,140,60,0.15)', borderWidth: 1, borderColor: COLORS.laurel + '88', borderRadius: RADIUS.sm },
  immunityText: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.3 },
});
