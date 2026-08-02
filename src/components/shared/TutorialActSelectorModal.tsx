// TutorialActSelectorModal — Tutorial rebuild, ticket 07. The in-game half
// of the guided path's entry point (the other half is StartMenuScreen's
// pre-game beat picker, which has no save loaded yet and so can't reflect
// real progress — see that file's own TUTORIAL_BEAT_PICKS comment). Reached
// from SettingsModal's "GUIDED PATH" button, this reads the LIVE store, so
// it can show real current/available status and offer real replay + leave.
//
// Status model (tutorial-rebuild-plan.md §2.4, adapted per this ticket's own
// scope decision — "have all three beats unlocked and available from the
// start"): a beat is either 'current' (tutorial.activeArc points at it —
// tapping just closes this modal, since TutorialLayer is already rendering
// it underneath) or 'available' (everything else, completed or not —
// tapping starts a side-effect-free teach-only replay via
// startTutorialReplay). Nothing is ever locked; "completed" only changes the
// row's badge, never whether it's tappable — jumping the REAL activeArc
// pointer into an unearned beat isn't offered here (that's what the
// pre-game chapter picker is for, on a fresh save with no ambition-slot
// collisions to worry about — see gameStore.ts's startGame startArc param).

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { TUTORIAL_ARCS, TUTORIAL_BEAT_PICKS, LEAVE_GUIDED_PATH_COPY } from '../../data/tutorialScript';
import type { TutorialBeatId } from '../../models/tutorial';
import ConfirmModal from './ConfirmModal';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TutorialActSelectorModal({ visible, onClose }: Props) {
  const tutorial = useGameStore(s => s.tutorial);
  const startTutorialReplay = useGameStore(s => s.startTutorialReplay);
  const skipTutorialArc = useGameStore(s => s.skipTutorialArc);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const canLeave = !!tutorial.activeArc;

  function handleRowPress(id: TutorialBeatId) {
    if (tutorial.activeArc === id) {
      // Already the real, live arc — TutorialLayer is rendering it right
      // now underneath this modal. Nothing to do but get out of the way.
      onClose();
      return;
    }
    startTutorialReplay(id);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.titleRow}>
          <Text style={s.title}>THE GUIDED PATH</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.blurb}>
          Every beat is open to review, whenever you like. Reviewing walks Philon's teaching again — narration and
          spotlights only, nothing is granted and nothing changes in your game.
        </Text>

        {TUTORIAL_BEAT_PICKS.map(beat => {
          const isCurrent = tutorial.activeArc === beat.id;
          const isCompleted = tutorial.completedArcs.includes(beat.id);
          return (
            <TouchableOpacity
              key={beat.id}
              style={[s.row, isCurrent && s.rowCurrent]}
              onPress={() => handleRowPress(beat.id)}
              activeOpacity={0.75}
            >
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{TUTORIAL_ARCS[beat.id].title}</Text>
                <Text style={s.rowSubtitle}>{beat.subtitle}</Text>
              </View>
              <Text style={s.rowBadge}>
                {isCurrent ? 'IN PROGRESS' : isCompleted ? 'REVIEW' : 'PREVIEW'}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[s.leaveBtn, !canLeave && s.leaveBtnDisabled]}
          onPress={() => canLeave && setLeaveConfirmOpen(true)}
          activeOpacity={canLeave ? 0.75 : 1}
          disabled={!canLeave}
        >
          <Text style={[s.leaveText, !canLeave && s.leaveTextDisabled]}>Leave the guided path</Text>
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={leaveConfirmOpen}
        title={LEAVE_GUIDED_PATH_COPY.title}
        message={LEAVE_GUIDED_PATH_COPY.message}
        confirmLabel={LEAVE_GUIDED_PATH_COPY.confirmLabel}
        cancelLabel={LEAVE_GUIDED_PATH_COPY.cancelLabel}
        destructive
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          skipTutorialArc();
          onClose();
        }}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </Modal>
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
    marginBottom: SPACING.sm,
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
  blurb: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 52,
  },
  rowCurrent: {
    borderColor: COLORS.goldDim,
    borderWidth: 1.5,
  },
  rowText: { flex: 1, marginRight: SPACING.sm },
  rowTitle: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: 2,
  },
  rowBadge: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
  },
  leaveBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.crimson + '66',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  leaveBtnDisabled: {
    opacity: 0.4,
    borderColor: COLORS.border,
  },
  leaveText: {
    color: COLORS.crimson,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
  },
  leaveTextDisabled: {
    color: COLORS.dust,
  },
});
