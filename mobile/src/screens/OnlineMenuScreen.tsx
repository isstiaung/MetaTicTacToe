// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { generateCode, normalizeCode } from '../online/config';

interface OnlineMenuScreenProps {
  name: string;
  onChangeName: (name: string) => void;
  /** Start (or join) a game in the given room code. */
  onConnect: (code: string) => void;
  onHome: () => void;
}

export function OnlineMenuScreen({
  name,
  onChangeName,
  onConnect,
  onHome,
}: OnlineMenuScreenProps) {
  const [joinCode, setJoinCode] = useState('');

  const trimmedName = name.trim();
  const canJoin = normalizeCode(joinCode).length === 4;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onHome} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText} allowFontScaling={false}>
            ‹ Home
          </Text>
        </Pressable>
        <Text style={styles.modeLabel} allowFontScaling={false}>
          Online
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel} allowFontScaling={false}>
            Your name
          </Text>
          <TextField
            value={name}
            onChangeText={onChangeName}
            placeholder="Enter a name"
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Button
            label="Create game"
            onPress={() => onConnect(generateCode())}
          />
          <Text style={styles.hint} allowFontScaling={false}>
            We'll make a room and give you a code to share.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.fieldLabel} allowFontScaling={false}>
            Join with a code
          </Text>
          <TextField
            value={joinCode}
            onChangeText={(t) => setJoinCode(normalizeCode(t))}
            placeholder="CODE"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            style={styles.codeInput}
          />
          <Button
            label="Join game"
            variant="secondary"
            onPress={() => canJoin && onConnect(normalizeCode(joinCode))}
            style={canJoin ? undefined : styles.disabled}
          />
        </View>
      </View>

      {!trimmedName ? (
        <Text style={styles.footnote} allowFontScaling={false}>
          Tip: add a name so your opponent knows who you are.
        </Text>
      ) : null}

      <Text style={styles.finePrint} allowFontScaling={false}>
        Inactive rooms are freed after 6 hours.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  backBtn: {
    paddingVertical: space.xs,
    paddingRight: space.md,
  },
  backText: {
    fontSize: typography.size.md,
    color: palette.inkSoft,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  modeLabel: {
    fontSize: typography.size.sm,
    color: palette.muted,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: space.xl,
  },
  field: {
    gap: space.sm,
  },
  section: {
    gap: space.sm,
  },
  fieldLabel: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
    paddingHorizontal: space.xs,
  },
  hint: {
    fontSize: typography.size.xs,
    color: palette.muted,
    paddingHorizontal: space.xs,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
  },
  codeInput: {
    letterSpacing: 6,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  footnote: {
    textAlign: 'center',
    fontSize: typography.size.xs,
    color: palette.muted,
  },
  finePrint: {
    textAlign: 'center',
    fontSize: typography.size.xs,
    color: palette.muted,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
});
