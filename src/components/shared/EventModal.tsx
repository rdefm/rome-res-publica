import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { EVENT_DEFS } from '../../data/events';
import EventCard from './EventCard';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

const { width, height } = Dimensions.get('window');

export default function EventModal() {
  const activeEvent = useGameStore(s => s.activeEvent);
  const resolveEvent = useGameStore(s => s.resolveEvent);
  const dismissEvent = useGameStore(s => s.dismissEvent);

  if (!activeEvent) return null;

  const def = EVENT_DEFS.find(d => d.id === activeEvent.defId);
  if (!def) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>AN EVENT UNFOLDS</Text>

        <EventCard
          def={def}
          instance={activeEvent}
          onChoiceMade={(choiceId, previewClientName) => {
            resolveEvent(choiceId, previewClientName);
          }}
        />

        <TouchableOpacity style={styles.skipBtn} onPress={dismissEvent}>
          <Text style={styles.skipTxt}>Dismiss</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(10,8,6,0.92)',
  },
  scroll: {
    width: '100%',
    maxHeight: height * 0.85,
  },
  scrollContent: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  heading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  skipBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  skipTxt: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    letterSpacing: 1,
  },
});
