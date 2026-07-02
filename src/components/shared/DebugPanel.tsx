import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { EVENT_DEFS } from '../../data/events';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Resource = 'fides' | 'lifetimeDignitas' | 'denarii' | 'crisisLevel';

const RESOURCES: { key: Resource; label: string; color: string }[] = [
  { key: 'fides',            label: 'Fides',              color: COLORS.fidesColor        },
  { key: 'lifetimeDignitas', label: 'Dignitas (Legacy)',  color: COLORS.lifetimeDignColor },
  { key: 'denarii',          label: 'Denarii',            color: COLORS.denariiColor      },
  { key: 'crisisLevel',      label: 'Crisis',             color: COLORS.crimson           },
];

const CHARACTER_FIELDS: { key: string; label: string }[] = [
  { key: 'age',             label: 'Age'             },
  { key: 'familyTrust',     label: 'Family Trust'    },
  { key: 'corruptionScore', label: 'Corruption'      },
  { key: 'relationship',    label: 'Relationship'    },
  { key: 'skills.rhetoric',   label: 'Skill: Rhetoric'   },
  { key: 'skills.martial',    label: 'Skill: Martial'    },
  { key: 'skills.intrigus',   label: 'Skill: Intrigus'   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCharacterField(char: any, key: string): number {
  if (key.startsWith('skills.')) {
    return char.skills?.[key.split('.')[1]] ?? 0;
  }
  return char[key] ?? 0;
}

function setCharacterField(char: any, key: string, value: number): any {
  if (key.startsWith('skills.')) {
    const skill = key.split('.')[1];
    return { ...char, skills: { ...char.skills, [skill]: value } };
  }
  return { ...char, [key]: value };
}

// ─── Section: Resources ───────────────────────────────────────────────────────

function ResourceSection() {
  const state = useGameStore();
  const [inputs, setInputs] = useState<Record<string, string>>({});

  function apply(key: Resource) {
    const raw = inputs[key] ?? '';
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    if (key === 'crisisLevel') {
      useGameStore.setState({ crisisLevel: Math.min(100, Math.max(0, val)) });
    } else {
      useGameStore.setState({ [key]: Math.max(0, val) } as any);
    }
    setInputs(prev => ({ ...prev, [key]: '' }));
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>RESOURCES</Text>
      {RESOURCES.map(({ key, label, color }) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.rowLabel, { color }]}>{label}</Text>
          <Text style={styles.rowCurrent}>{(state as any)[key]}</Text>
          <TextInput
            style={styles.input}
            value={inputs[key] ?? ''}
            onChangeText={v => setInputs(prev => ({ ...prev, [key]: v }))}
            keyboardType="numeric"
            placeholder="set to…"
            placeholderTextColor={COLORS.dust}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={() => apply(key)}>
            <Text style={styles.applyBtnText}>SET</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Character Stats ─────────────────────────────────────────────────

function CharacterSection() {
  const family = useGameStore(s => s.family);
  const [selectedId, setSelectedId] = useState<string>(family[0]?.id ?? '');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = family.find(c => c.id === selectedId) ?? family[0];

  function apply(fieldKey: string) {
    const raw = inputs[fieldKey] ?? '';
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    const updatedFamily = family.map(c =>
      c.id === selected.id ? setCharacterField(c, fieldKey, val) : c
    );
    useGameStore.setState({ family: updatedFamily });
    setInputs(prev => ({ ...prev, [fieldKey]: '' }));
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CHARACTER STATS</Text>

      {/* Character picker */}
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerOpen(true)}>
        <Text style={styles.pickerBtnText}>
          {selected?.name ?? 'Select character'} ▾
        </Text>
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <View style={styles.pickerModal}>
            {family.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickerItem, c.id === selectedId && styles.pickerItemActive]}
                onPress={() => { setSelectedId(c.id); setPickerOpen(false); }}
              >
                <Text style={styles.pickerItemText}>{c.name}</Text>
                <Text style={styles.pickerItemSub}>{c.role} · Age {c.age}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fields */}
      {CHARACTER_FIELDS.map(({ key, label }) => (
        <View key={key} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowCurrent}>{getCharacterField(selected, key)}</Text>
          <TextInput
            style={styles.input}
            value={inputs[key] ?? ''}
            onChangeText={v => setInputs(prev => ({ ...prev, [key]: v }))}
            keyboardType="numeric"
            placeholder="set to…"
            placeholderTextColor={COLORS.dust}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={() => apply(key)}>
            <Text style={styles.applyBtnText}>SET</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Events ──────────────────────────────────────────────────────────

function EventsSection() {
  const [search, setSearch] = useState('');

  const filtered = EVENT_DEFS.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.id.toLowerCase().includes(search.toLowerCase())
  );

  function fire(defId: string) {
    const instance = {
      defId,
      firedAtTurn: useGameStore.getState().turnNumber,
      targetCharacterId: 'pc-1',
    };
    useGameStore.setState({ activeEvent: instance });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>FIRE EVENT</Text>
      <TextInput
        style={[styles.input, styles.searchInput]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search events…"
        placeholderTextColor={COLORS.dust}
      />
      {filtered.map(def => (
        <TouchableOpacity key={def.id} style={styles.eventRow} onPress={() => fire(def.id)}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>{def.title}</Text>
            <Text style={styles.eventId}>{def.id}</Text>
          </View>
          <View style={[styles.weightBadge, def.weight === 0 && styles.weightBadgeZero]}>
            <Text style={styles.weightBadgeText}>w:{def.weight}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DebugPanel() {
  const [tab, setTab] = useState<'resources' | 'characters' | 'events'>('resources');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙ DEBUG</Text>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['resources', 'characters', 'events'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'resources'  && <ResourceSection />}
        {tab === 'characters' && <CharacterSection />}
        {tab === 'events'     && <EventsSection />}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.crimson,
  },
  header: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.crimson,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.crimson,
  },
  tabText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.dust,
  },
  tabTextActive: {
    color: COLORS.crimson,
  },
  scroll: {
    maxHeight: 420,
  },
  section: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.goldDim,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.marble,
    width: 110,
  },
  rowCurrent: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.gold,
    width: 36,
    textAlign: 'right',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
  searchInput: {
    flex: undefined,
    width: '100%',
    marginBottom: SPACING.xs,
  },
  applyBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  applyBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 1,
  },

  // Character picker
  pickerBtn: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pickerBtnText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  pickerModal: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  pickerItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemActive: {
    backgroundColor: COLORS.panelSurface,
  },
  pickerItemText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.marble,
  },
  pickerItemSub: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  },

  // Events
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  eventRowInner: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.marble,
  },
  eventId: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.dust,
    marginTop: 1,
  },
  weightBadge: {
    backgroundColor: COLORS.laurel,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  weightBadgeZero: {
    backgroundColor: COLORS.panelElevated,
  },
  weightBadgeText: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.marble,
  },
});
