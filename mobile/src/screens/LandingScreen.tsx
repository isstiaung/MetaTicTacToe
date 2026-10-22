// SPDX-License-Identifier: GPL-3.0-or-later

import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';
import type { Difficulty } from '@mtt/engine';
import { Button } from '../components/Button';
import { HelpButton } from '../components/HelpButton';
import { TextField } from '../components/TextField';
import type { Mode } from '../useGame';

const RULES_URL =
  'https://isstiaung.me/meta-tictactoe-rules-6ac9bc68d079';

interface LandingScreenProps {
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onStart: (mode: Mode) => void;
  /** The player's display name (used by online play; persisted by the parent). */
  name: string;
  onChangeName: (name: string) => void;
  /** Open the online menu. */
  onStartOnline: () => void;
}

export function LandingScreen({
  difficulty,
  onChangeDifficulty,
  onStart,
  name,
  onChangeName,
  onStartOnline,
}: LandingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand} allowFontScaling={false}>
          Meta<Text style={styles.brandAccent}>Tic</Text>Tac
          <Text style={styles.brandAccentO}>Toe</Text>
        </Text>
        <Text style={styles.tagline} allowFontScaling={false}>
          Nine boards, one game. Win the small grids to claim the big one.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="2 Players" onPress={() => onStart('two-player')} />

        <View style={styles.vsBlock}>
          <Button
            label="vs Computer"
            variant="secondary"
            onPress={() => onStart('vs-computer')}
          />
          <View style={styles.toggle}>
            {(['easy', 'hard'] as Difficulty[]).map((d) => {
              const selected = difficulty === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => onChangeDifficulty(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${d === 'easy' ? 'Easy' : 'Hard'} difficulty`}
                  style={[
                    styles.toggleOption,
                    selected && styles.toggleOptionActive,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.toggleLabel,
                      selected && styles.toggleLabelActive,
                    ]}
                  >
                    {d === 'easy' ? 'Easy' : 'Hard'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.onlineBlock}>
          <Button
            label="Online"
            variant="secondary"
            onPress={onStartOnline}
          />
          <TextField
            value={name}
            onChangeText={onChangeName}
            placeholder="Your name (for online)"
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.footerRow}>
        <HelpButton />
        <Pressable
          onPress={() => Linking.openURL(RULES_URL)}
          hitSlop={12}
          accessibilityRole="link"
          accessibilityLabel="Open the full rules article"
        >
          <Text style={styles.rulesText} allowFontScaling={false}>
            Full rules ↗
          </Text>
        </Pressable>
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
  brand: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
    letterSpacing: -1,
    textAlign: 'center',
  },
  brandAccent: {
    color: palette.x,
  },
  brandAccentO: {
    color: palette.o,
  },
  tagline: {
    fontSize: typography.size.md,
    color: palette.inkSoft,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
    maxWidth: 320,
  },
  actions: {
    gap: space.lg,
  },
  vsBlock: {
    gap: space.md,
  },
  onlineBlock: {
    gap: space.md,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.pill,
    padding: space.xs,
    gap: space.xs,
  },
  toggleOption: {
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  toggleOptionActive: {
    backgroundColor: palette.surface,
  },
  toggleLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
    color: palette.muted,
  },
  toggleLabelActive: {
    color: palette.ink,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  rulesText: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
});
