// SPDX-License-Identifier: MIT

import { Modal, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import { Button } from './Button';

interface RulesModalProps {
  /** Show/hide the dialog. */
  visible: boolean;
  /** Close (backdrop tap, ✕, or "Got it"). */
  onClose: () => void;
}

/**
 * A quick in-app explainer of the Ultimate / Meta Tic-Tac-Toe rules — the mobile
 * counterpart of the web RulesModal. Opened from the "?" button (HelpButton) and
 * auto-shown once at a player's first game.
 */
export function RulesModal({ visible, onClose }: RulesModalProps) {
  const rules = [
    <Text style={styles.ruleText} allowFontScaling={false}>
      The board is <Text style={styles.bold}>nine</Text> small tic-tac-toe boards in a 3×3 grid.
    </Text>,
    <Text style={styles.ruleText} allowFontScaling={false}>
      Win a small board to claim its square on the big board.{' '}
      <Text style={styles.bold}>Line up three claimed squares to win the game.</Text>
    </Text>,
    <Text style={styles.ruleText} allowFontScaling={false}>
      Your move sends your opponent to the matching board — play the{' '}
      <Text style={styles.italic}>top-right</Text> cell and they must play in the{' '}
      <Text style={styles.italic}>top-right</Text> board next.
    </Text>,
    <Text style={styles.ruleText} allowFontScaling={false}>
      If that board is already finished, they may play in <Text style={styles.bold}>any</Text> open
      board.
    </Text>,
    <Text style={styles.ruleText} allowFontScaling={false}>
      X moves first.
    </Text>,
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close rules">
        {/* Stop taps inside the card from dismissing. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.closeGlyph} allowFontScaling={false}>
              ×
            </Text>
          </Pressable>

          <Text style={styles.title} allowFontScaling={false}>
            How to play
          </Text>
          <Text style={styles.sub} allowFontScaling={false}>
            Tic-tac-toe, nine times over.
          </Text>

          <View style={styles.list}>
            {rules.map((node, i) => (
              <View style={styles.rule} key={i}>
                <Text style={styles.ruleNum} allowFontScaling={false}>
                  {i + 1}
                </Text>
                <View style={styles.ruleBody}>{node}</View>
              </View>
            ))}
          </View>

          <Button label="Got it" onPress={onClose} style={styles.gotIt} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.sm,
    shadowColor: shadow.card.shadowColor,
    shadowOpacity: shadow.card.shadowOpacity,
    shadowRadius: shadow.card.shadowRadius,
    shadowOffset: shadow.card.shadowOffset,
    elevation: shadow.card.elevation,
  },
  closeBtn: {
    position: 'absolute',
    top: space.md,
    right: space.lg,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeGlyph: {
    fontSize: typography.size.xl,
    lineHeight: typography.size.xl,
    color: palette.muted,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
  },
  sub: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    marginBottom: space.sm,
  },
  list: {
    gap: space.md,
    marginBottom: space.lg,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  ruleNum: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    color: palette.inkSoft,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  ruleBody: {
    flex: 1,
  },
  ruleText: {
    fontSize: typography.size.sm,
    color: palette.ink,
    lineHeight: typography.size.sm * 1.45,
  },
  bold: {
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  italic: {
    fontStyle: 'italic',
    color: palette.inkSoft,
  },
  gotIt: {
    alignSelf: 'stretch',
  },
});
