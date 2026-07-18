import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import { useGameStore, INITIAL_STATE } from '../../state/gameStore';
import { saveProvider, exportSave, importSave } from '../../state/saveLoad';
import { GLOSSARY_TERMS } from '../../data/glossaryTerms';
import GlossaryPopup from './GlossaryPopup';
import InfoTap from './InfoTap';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ScrollModal, { PARCHMENT } from './ScrollModal';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'saving' | 'loading' | 'done' | 'error';

export default function SettingsModal({ visible, onClose }: Props) {
  const state = useGameStore();
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [tabulariumOpen, setTabulariumOpen] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  function flash(msg: string, isError = false) {
    setStatus(isError ? 'error' : 'done');
    setStatusMsg(msg);
    setTimeout(() => { setStatus('idle'); setStatusMsg(''); }, 2500);
  }

  async function handleSave() {
    setStatus('saving');
    try {
      await saveProvider.save(state);
      flash('Game saved.');
    } catch {
      flash('Save failed.', true);
    }
  }

  async function handleExport() {
    setStatus('saving');
    try {
      await exportSave(state);
      flash('Save file shared.');
    } catch {
      flash('Export failed.', true);
    }
  }

  async function handleImport() {
    setStatus('loading');
    try {
      const loaded = await importSave();
      if (!loaded) { flash('Import cancelled.'); return; }
      useGameStore.getState().loadGame(loaded);
      flash('Save loaded successfully.');
      onClose();
    } catch {
      flash('Import failed — file may be corrupt.', true);
    }
  }

  function handleNewGame() {
    Alert.alert(
      'New Game',
      'This will erase your current game. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New Game', style: 'destructive',
          onPress: () => {
            useGameStore.setState(INITIAL_STATE);
            onClose();
          },
        },
      ]
    );
  }

  const busy = status === 'saving' || status === 'loading';

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.titleRow}>
          <Text style={s.title}>SETTINGS</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <InfoTap termId="saves-and-backup" style={s.sectionLabelRow}>
          <Text style={s.sectionLabel}>SAVE</Text>
        </InfoTap>
        <Text style={s.saveStory}>
          Autosaves every season, and whenever you leave the app. {Platform.OS === 'ios'
            ? 'Your device’s own backup (iCloud or iTunes/Finder) covers it automatically.'
            : 'Android backs it up automatically if you have Google device backup turned on.'
          } Export makes a file you own — keep it anywhere. Import restores from one. There’s no account and no cloud sync of our own — your device’s backup and your own exported files are the whole story.
        </Text>

        <SettingsButton
          label="Save Game"
          desc="Save to this device"
          icon="💾"
          onPress={handleSave}
          disabled={busy}
        />
        <SettingsButton
          label="Export Save"
          desc="Share save file (JSON)"
          icon="📤"
          onPress={handleExport}
          disabled={busy}
        />
        <SettingsButton
          label="Import Save"
          desc="Load a save file from storage"
          icon="📥"
          onPress={handleImport}
          disabled={busy}
        />

        <View style={s.divider} />
        <Text style={s.sectionLabel}>GAME</Text>

        <SettingsButton
          label="New Game"
          desc="Erase current game and start fresh"
          icon="🔄"
          onPress={handleNewGame}
          disabled={busy}
          danger
        />

        {status !== 'idle' && (
          <View style={s.statusRow}>
            {busy
              ? <ActivityIndicator size="small" color={COLORS.gold} />
              : <Text style={[s.statusMsg, { color: status === 'error' ? COLORS.crimson : COLORS.laurel }]}>
                  {statusMsg}
                </Text>
            }
          </View>
        )}

        <View style={s.divider} />
        <Text style={s.sectionLabel}>REFERENCE</Text>

        <SettingsButton
          label="Tabularium"
          desc="Philon's records — all game terms explained"
          icon="📜"
          onPress={() => setTabulariumOpen(true)}
          disabled={busy}
        />

        <Text style={s.version}>Rome — Res Publica · v1</Text>
      </View>

      {/* ── Tabularium — alphabetical term list ─────────────────────────── */}
      <ScrollModal
        visible={tabulariumOpen}
        onClose={() => setTabulariumOpen(false)}
        title="TABULARIUM"
        subtitle="The household records, as Philon keeps them."
        animationType="fade"
      >
        <View style={tab.list}>
          {[...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term)).map(term => (
            <TouchableOpacity
              key={term.id}
              style={tab.row}
              onPress={() => setSelectedTermId(term.id)}
              activeOpacity={0.7}
            >
              <Text style={tab.term}>{term.term}</Text>
              <Text style={tab.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollModal>

      {/* GlossaryPopup spawned from within Tabularium */}
      {selectedTermId && (
        <GlossaryPopup
          termId={selectedTermId}
          visible={!!selectedTermId}
          onClose={() => setSelectedTermId(null)}
        />
      )}
    </Modal>
  );
}

function SettingsButton({ label, desc, icon, onPress, disabled, danger }: {
  label: string; desc: string; icon: string;
  onPress: () => void; disabled: boolean; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[sb.btn, danger && sb.dangerBtn, disabled && sb.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={sb.icon}>{icon}</Text>
      <View style={sb.text}>
        <Text style={[sb.label, danger && sb.dangerLabel]}>{label}</Text>
        <Text style={sb.desc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    top: '15%',
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  closeBtn: {
    color: COLORS.dust,
    fontSize: 18,
  },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
    marginTop: 2,
  },
  sectionLabelRow: {
    alignSelf: 'flex-start',
    marginBottom: 0,
  },
  saveStory: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  statusRow: {
    alignItems: 'center',
    marginTop: SPACING.md,
    minHeight: 24,
  },
  statusMsg: {
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
  version: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.5,
  },
});

const sb = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 52,
  },
  dangerBtn: {
    borderColor: COLORS.crimson + '66',
  },
  disabled: { opacity: 0.4 },
  icon: { fontSize: 22, marginRight: SPACING.sm },
  text: { flex: 1 },
  label: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerLabel: { color: COLORS.crimson },
  desc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: 2,
  },
});


const tab = StyleSheet.create({
  list: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PARCHMENT.border,
  },
  term: {
    fontFamily: FONTS.displayLight,
    fontSize: 13,
    color: PARCHMENT.body,
    flex: 1,
  },
  arrow: {
    fontFamily: FONTS.ui,
    fontSize: 16,
    color: PARCHMENT.muted,
    marginLeft: SPACING.sm,
  },
});
