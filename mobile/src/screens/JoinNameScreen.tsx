// SPDX-License-Identifier: GPL-3.0-or-later

import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { palette, space, typography } from '@mtt/theme';
import { Button } from '../components/Button';
import { HelpButton } from '../components/HelpButton';
import { TextField } from '../components/TextField';

interface JoinNameScreenProps {
  /** The room code being joined (from a shared deep link). */
  code: string;
  name: string;
  onChangeName: (name: string) => void;
  /** Proceed into the room once a name is set. */
  onJoin: () => void;
  /** Abandon the join and go back. */
  onBack: () => void;
}

/**
 * Name-entry step shown when opening a shared room deep link with no saved name — so a
 * first-time joiner can introduce themselves before the board opens. Mirrors web JoinName.
 */
export function JoinNameScreen({ code, name, onChangeName, onJoin, onBack }: JoinNameScreenProps) {
  const canJoin = name.trim().length > 0;
  const join = () => {
    if (canJoin) onJoin();
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title} allowFontScaling={false}>
          Join game
        </Text>
        <Text style={styles.tagline} allowFontScaling={false}>
          You're joining room <Text style={styles.code}>{code}</Text>. Pick a name so your opponent
          knows who you are.
        </Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel} allowFontScaling={false}>
            Your name
          </Text>
          <TextField
            value={name}
            onChangeText={onChangeName}
            placeholder="Player"
            maxLength={20}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={join}
          />
        </View>
        <Button
          label="Join game"
          onPress={join}
          style={canJoin ? undefined : styles.disabled}
        />
      </View>

      <View style={styles.footerRow}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cancel join"
        >
          <Text style={styles.back} allowFontScaling={false}>
            ‹ Cancel
          </Text>
        </Pressable>
        <HelpButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    gap: space.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: space.md,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: typography.size.md,
    color: palette.inkSoft,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
    maxWidth: 320,
  },
  code: {
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
  },
  actions: {
    gap: space.lg,
  },
  field: {
    gap: space.sm,
  },
  fieldLabel: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
    paddingHorizontal: space.xs,
  },
  disabled: {
    opacity: 0.45,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  back: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
});
