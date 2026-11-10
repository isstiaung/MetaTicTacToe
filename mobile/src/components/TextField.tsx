// SPDX-License-Identifier: MIT

import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';

interface TextFieldProps extends TextInputProps {
  /** Optional extra container style merged over the base input style. */
  containerStyle?: ViewStyle;
}

/**
 * Modern-minimal single-line input matching the @mtt/theme look: white surface, hairline
 * border, pill-ish rounded corners. Used for the player name and the join code.
 */
export function TextField({ containerStyle, style, ...rest }: TextFieldProps) {
  return (
    <TextInput
      placeholderTextColor={palette.muted}
      allowFontScaling={false}
      style={[styles.input, containerStyle, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    fontSize: typography.size.md,
    color: palette.ink,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
});
