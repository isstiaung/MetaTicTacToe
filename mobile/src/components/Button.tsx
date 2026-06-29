// SPDX-License-Identifier: GPL-3.0-or-later

import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { palette, radius, shadow, space, typography } from '@mtt/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}

function ButtonImpl({ label, onPress, variant = 'primary', style }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  const containerStyle: ViewStyle = {
    backgroundColor: isPrimary
      ? palette.accent
      : isGhost
        ? 'transparent'
        : palette.surface,
    borderWidth: isGhost ? 0 : 1,
    borderColor: isPrimary ? palette.accent : palette.lineStrong,
  };

  const textStyle: TextStyle = {
    color: isPrimary ? palette.accentText : isGhost ? palette.accent : palette.ink,
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        containerStyle,
        isPrimary && !isGhost ? shadowProps : null,
        { opacity: pressed ? 0.82 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, textStyle]} allowFontScaling={false}>
        {label}
      </Text>
    </Pressable>
  );
}

const shadowProps = {
  shadowColor: shadow.card.shadowColor,
  shadowOpacity: shadow.card.shadowOpacity,
  shadowRadius: shadow.card.shadowRadius,
  shadowOffset: shadow.card.shadowOffset,
  elevation: shadow.card.elevation,
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
  },
});

export const Button = memo(ButtonImpl);
