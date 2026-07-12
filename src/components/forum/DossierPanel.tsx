import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { Secret } from '../../models/secret';
import { isDeterred, payOffCost, discreditChance } from '../../engine/secretEngine';
import { SECRET_TYPE_DEFS, SECRET_CLASS_BY_TYPE } from '../../data/secretDefinitions';
import { BALANCE } from '../../data/balance';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import InfoTap from '../shared/InfoTap';

// ─── Phase 4, Chunk P4-B — Dossier ────────────────────────────────────────────
// Held-by-you (Leverage/Extort/Burn) and held-against-you (Pay Off/Discredit)
// lists. Undiscovered Secrets held against the family never render here —
// the Dossier is the player's own knowledge, not omniscience.

function potencyDots(potency: 1 | 2 | 3) {
  return '●'.repeat(potency) + '○'.repeat(3 - potency);
}

// ─── Leverage picker (bill / election) ───────────────────────────────────────

function LeveragePickerModal({
  visible,
  secret,
  onClose,
}: {
  visible: boolean;
  secret: Secret | null;
  onClose: () => void;
}) {
  const bills = useGameStore(s => s.bills);
  const campaigning = useGameStore(s => s.campaigning);
  const leverageSecretForBill = useGameStore(s => s.leverageSecretForBill);
  const leverageSecretForElection = useGameStore(s => s.leverageSecretForElection);

  if (!secret) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pk.modal}>
          <Text style={pk.title}>LEVERAGE — CHOOSE THE PRICE</Text>
          <Text style={pk.subtitle}>{secret.flavorText}</Text>

          {campaigning && (
            <TouchableOpacity
              style={pk.row}
              onPress={() => { leverageSecretForElection(secret.id); onClose(); }}
            >
              <Text style={pk.rowLabel}>Lock their bloc behind your campaign</Text>
              <Text style={pk.rowSub}>Free — the Secret is spent.</Text>
            </TouchableOpacity>
          )}

          {bills.length === 0 && !campaigning && (
            <Text style={pk.empty}>No live bill or campaign to leverage right now.</Text>
          )}

          {bills.map(bill => (
            <View key={bill.id} style={pk.billRow}>
              <Text style={pk.rowLabel} numberOfLines={1}>{bill.name}</Text>
              <View style={pk.billBtns}>
                <TouchableOpacity
                  style={pk.smallBtn}
                  onPress={() => { leverageSecretForBill(secret.id, bill.id, 'for'); onClose(); }}
                >
                  <Text style={pk.smallBtnText}>FOR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[pk.smallBtn, pk.smallBtnAgainst]}
                  onPress={() => { leverageSecretForBill(secret.id, bill.id, 'against'); onClose(); }}
                >
                  <Text style={pk.smallBtnText}>AGAINST</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Discredit agent picker ───────────────────────────────────────────────────

function DiscreditPickerModal({
  visible,
  secret,
  onClose,
}: {
  visible: boolean;
  secret: Secret | null;
  onClose: () => void;
}) {
  const family = useGameStore(s => s.family);
  const discreditSecret = useGameStore(s => s.discreditSecret);
  const eligible = family.filter(c => c.age >= 18);

  if (!secret) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pk.modal}>
          <Text style={pk.title}>WHO DISCREDITS THE STORY?</Text>
          <Text style={pk.subtitle}>Failure makes it worse — potency rises.</Text>
          {eligible.map(c => (
            <TouchableOpacity
              key={c.id}
              style={pk.row}
              onPress={() => { discreditSecret(secret.id, c.id); onClose(); }}
            >
              <Text style={pk.rowLabel}>{c.isPlayer ? '⭐ ' : ''}{c.name}</Text>
              <Text style={pk.rowSub}>{Math.round(discreditChance(c.skills.intrigus) * 100)}% · Intrigus {c.skills.intrigus}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── File Prosecution delay picker (Phase 4, Chunk P4-C) ────────────────────

export function FileProsecutionPickerModal({
  visible,
  leaderId,
  onClose,
}: {
  visible: boolean;
  leaderId: string | null;
  onClose: () => void;
}) {
  const fileProsecution = useGameStore(s => s.fileProsecution);
  if (!leaderId) return null;
  const [minDelay, maxDelay] = BALANCE.trials.startDelayBand;
  const delays = Array.from({ length: maxDelay - minDelay + 1 }, (_, i) => minDelay + i);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pk.modal}>
          <Text style={pk.title}>WHEN DOES THE TRIAL BEGIN?</Text>
          <Text style={pk.subtitle}>
            Sooner catches them unprepared; later gives you more time to build your own case — but them too.
          </Text>
          {delays.map(delay => (
            <TouchableOpacity
              key={delay}
              style={pk.row}
              onPress={() => { fileProsecution(leaderId, delay); onClose(); }}
            >
              <Text style={pk.rowLabel}>{delay} season{delay !== 1 ? 's' : ''} from now</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const pk = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
  modal: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md },
  title: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginBottom: SPACING.sm },
  empty: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, paddingVertical: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, flexShrink: 1, marginRight: SPACING.sm },
  rowSub: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 11 },
  billRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  billBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  smallBtn: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.laurel, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  smallBtnAgainst: { borderColor: COLORS.crimson },
  smallBtnText: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 0.5 },
  cancelBtn: { marginTop: SPACING.sm, alignItems: 'center', paddingVertical: 6 },
  cancelBtnText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
});

// ─── Secret row ───────────────────────────────────────────────────────────────

function HeldByYouRow({ secret }: { secret: Secret }) {
  const clans = useGameStore(s => s.clans);
  const secrets = useGameStore(s => s.secrets);
  const trials = useGameStore(s => s.trials);
  const extortSecret = useGameStore(s => s.extortSecret);
  const stopExtortion = useGameStore(s => s.stopExtortion);
  const burnSecret = useGameStore(s => s.burnSecret);
  const [leveragePickerOpen, setLeveragePickerOpen] = useState(false);
  const [prosecutionPickerOpen, setProsecutionPickerOpen] = useState(false);

  const subject = secret.subject;
  if (subject.kind !== 'leader') return null;
  const leader = clans.flatMap(c => c.leaders).find(l => l.id === subject.leaderId);
  const frozen = isDeterred(subject.leaderId, secrets);
  const def = SECRET_TYPE_DEFS[secret.type];
  const isCriminal = SECRET_CLASS_BY_TYPE[secret.type] === 'criminal';
  const trialAlreadyActive = trials.some(t => t.status !== 'resolved');

  return (
    <View style={row.card}>
      <View style={row.headerRow}>
        <Text style={row.icon}>{def.icon}</Text>
        <View style={row.headerInfo}>
          <Text style={row.leaderName}>{leader?.name ?? 'Unknown'}</Text>
          <Text style={row.potency}>{potencyDots(secret.potency)} · {def.displayName}</Text>
        </View>
        {secret.status === 'extorting' && <View style={row.extortingBadge}><Text style={row.extortingBadgeText}>EXTORTING</Text></View>}
      </View>
      <Text style={row.flavor} numberOfLines={2}>{secret.flavorText}</Text>

      {frozen ? (
        <Text style={row.frozenNote}>Stayed by your hand on his own affairs — a standoff, for now.</Text>
      ) : secret.status === 'extorting' ? (
        <TouchableOpacity style={row.actionBtn} onPress={() => stopExtortion(secret.id)}>
          <Text style={row.actionBtnText}>Stop Extorting (spends the Secret)</Text>
        </TouchableOpacity>
      ) : (
        <View style={row.actionsRow}>
          <TouchableOpacity style={row.actionBtn} onPress={() => setLeveragePickerOpen(true)}>
            <Text style={row.actionBtnText}>Leverage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={row.actionBtn} onPress={() => extortSecret(secret.id)}>
            <Text style={row.actionBtnText}>Extort</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[row.actionBtn, row.burnBtn]} onPress={() => burnSecret(secret.id)}>
            <Text style={[row.actionBtnText, row.burnBtnText]}>Burn</Text>
          </TouchableOpacity>
          {isCriminal && (
            <TouchableOpacity
              style={[row.actionBtn, row.prosecuteBtn, trialAlreadyActive && row.actionBtnDisabled]}
              disabled={trialAlreadyActive}
              onPress={() => setProsecutionPickerOpen(true)}
            >
              <Text style={[row.actionBtnText, row.prosecuteBtnText]}>
                {trialAlreadyActive ? 'The courts are occupied' : 'File Prosecution'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <LeveragePickerModal visible={leveragePickerOpen} secret={secret} onClose={() => setLeveragePickerOpen(false)} />
      <FileProsecutionPickerModal
        visible={prosecutionPickerOpen}
        leaderId={subject.leaderId}
        onClose={() => setProsecutionPickerOpen(false)}
      />
    </View>
  );
}

function HeldAgainstYouRow({ secret }: { secret: Secret }) {
  const clans = useGameStore(s => s.clans);
  const family = useGameStore(s => s.family);
  const secrets = useGameStore(s => s.secrets);
  const denarii = useGameStore(s => s.denarii);
  const payOffSecret = useGameStore(s => s.payOffSecret);
  const [discreditPickerOpen, setDiscreditPickerOpen] = useState(false);

  const subject = secret.subject;
  if (subject.kind !== 'family') return null;
  const leader = clans.flatMap(c => c.leaders).find(l => l.id === secret.holder);
  const character = family.find(c => c.id === subject.characterId);
  const frozen = isDeterred(secret.holder, secrets);
  const def = SECRET_TYPE_DEFS[secret.type];
  const cost = payOffCost(secret.potency);

  return (
    <View style={row.card}>
      <View style={row.headerRow}>
        <Text style={row.icon}>{def.icon}</Text>
        <View style={row.headerInfo}>
          <Text style={row.leaderName}>{leader?.name ?? 'Unknown'} holds this on {character?.name ?? 'your family'}</Text>
          <Text style={row.potency}>{potencyDots(secret.potency)} · {def.displayName}</Text>
        </View>
        {secret.status === 'extorting' && <View style={row.extortingBadge}><Text style={row.extortingBadgeText}>PAYING</Text></View>}
      </View>
      <Text style={row.flavor} numberOfLines={2}>{secret.flavorText}</Text>
      {frozen && (
        <Text style={row.frozenNote}>You hold something of his in turn — neither of you can move first.</Text>
      )}

      <View style={row.actionsRow}>
        <TouchableOpacity
          style={[row.actionBtn, denarii < cost && row.actionBtnDisabled]}
          disabled={denarii < cost}
          onPress={() => payOffSecret(secret.id)}
        >
          <Text style={row.actionBtnText}>Pay Off ({cost} Denarii)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={row.actionBtn} onPress={() => setDiscreditPickerOpen(true)}>
          <Text style={row.actionBtnText}>Discredit</Text>
        </TouchableOpacity>
      </View>

      <DiscreditPickerModal visible={discreditPickerOpen} secret={secret} onClose={() => setDiscreditPickerOpen(false)} />
    </View>
  );
}

const row = StyleSheet.create({
  card: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, marginRight: SPACING.sm },
  headerInfo: { flex: 1 },
  leaderName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  potency: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, marginTop: 1 },
  extortingBadge: { backgroundColor: COLORS.denariiColor + '33', borderWidth: 1, borderColor: COLORS.denariiColor, borderRadius: RADIUS.sm, paddingHorizontal: 5, paddingVertical: 2 },
  extortingBadgeText: { color: COLORS.denariiColor, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.5 },
  flavor: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  frozenNote: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 6 },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '600' },
  burnBtn: { borderColor: COLORS.crimson },
  burnBtnText: { color: COLORS.crimson },
  prosecuteBtn: { borderColor: COLORS.senatBlue },
  prosecuteBtnText: { color: COLORS.senatBlue },
});

// ─── DossierPanel ─────────────────────────────────────────────────────────────

export default function DossierPanel() {
  const secrets = useGameStore(s => s.secrets);
  const [expanded, setExpanded] = useState(false);

  const heldByYou = secrets.filter(s => s.holder === 'player' && (s.status === 'held' || s.status === 'extorting'));
  const heldAgainstYou = secrets.filter(
    s => s.holder !== 'player' && s.subject.kind === 'family' && s.discovered && (s.status === 'held' || s.status === 'extorting')
  );

  if (heldByYou.length === 0 && heldAgainstYou.length === 0) return null;

  return (
    <View style={dp.container}>
      <TouchableOpacity style={dp.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <InfoTap termId="dossier">
          <Text style={dp.title}>DOSSIER</Text>
        </InfoTap>
        <Text style={dp.count}>{heldByYou.length} held · {heldAgainstYou.length} against you</Text>
        <Text style={dp.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={dp.body}>
          {heldByYou.length > 0 && (
            <>
              <Text style={dp.sectionLabel}>WHAT YOU HOLD</Text>
              {heldByYou.map(s => <HeldByYouRow key={s.id} secret={s} />)}
            </>
          )}
          {heldAgainstYou.length > 0 && (
            <>
              <Text style={dp.sectionLabel}>HELD AGAINST YOU</Text>
              {heldAgainstYou.map(s => <HeldAgainstYouRow key={s.id} secret={s} />)}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const dp = StyleSheet.create({
  container: { backgroundColor: 'rgba(200,168,112,0.06)', borderWidth: 1, borderColor: COLORS.goldDim, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.sm },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  count: { flex: 1, color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10 },
  chevron: { color: COLORS.dust, fontSize: 12 },
  body: { padding: SPACING.sm, paddingTop: 0 },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: SPACING.sm, marginBottom: SPACING.xs },
});
