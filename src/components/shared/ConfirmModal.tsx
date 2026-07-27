// ConfirmModal — reusable Alert.alert replacement.
// react-native-web's Alert.alert is a hard no-op (node_modules/react-native-web
// /dist/exports/Alert/index.js: `static alert() {}`), so every confirm/info
// dialog built on it was silently unusable when running on web — found while
// fixing the tutorial's "Philon, I know this" skip flow, which routed
// through Alert.alert this way. This renders as a real Modal instead, which
// react-native-web does implement, so behavior is identical on native and web.
//
// Omit cancelLabel/onCancel for a single-button info alert (tapping the
// backdrop or the one button both call onConfirm).
import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  visible, title, message, confirmLabel = 'OK', cancelLabel, destructive, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel ?? onConfirm} />
      <View style={s.positioner} pointerEvents="box-none">
        <View style={s.sheet}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.buttonRow}>
            {cancelLabel && (
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel} activeOpacity={0.75}>
                <Text style={s.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.btn, destructive ? s.destructiveBtn : s.confirmBtn]}
              onPress={onConfirm}
              activeOpacity={0.75}
            >
              <Text style={destructive ? s.destructiveText : s.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  positioner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  message: {
    color: COLORS.marble,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  btn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: COLORS.gold,
  },
  confirmText: {
    color: COLORS.bg,
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  destructiveBtn: {
    backgroundColor: COLORS.crimson,
  },
  destructiveText: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
});
