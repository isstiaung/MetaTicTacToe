// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';
import { RulesModal } from './RulesModal';

interface HelpButtonProps {
  style?: ViewStyle;
}

/**
 * A self-contained "?" button that opens the rules explainer — drop it into any
 * top bar or footer. Manages its own modal open state. Mirrors the web HelpButton.
 */
export function HelpButton({ style }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }, style]}
        accessibilityLabel="How to play"
        accessibilityRole="button"
      >
        <Text style={styles.glyph} allowFontScaling={false}>
          ?
        </Text>
      </Pressable>
      <RulesModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md,
    color: palette.inkSoft,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    marginTop: -space.xs / 2,
  },
});
