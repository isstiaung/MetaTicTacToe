// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import {
  boardScore,
  gameSummaryText,
  type GameState,
  type Outcome,
  type Player,
} from '@mtt/engine';
import { Button } from './Button';
import { Mark } from './Mark';

/** Public app/rules link appended to shared summaries. */
const SHARE_URL = 'https://isstiaung.me/meta-tictactoe-rules-6ac9bc68d079';

interface ResultOverlayProps {
  /** Non-null winner shows the overlay; null hides it. */
  winner: Outcome;
  /** Full game state — drives the score readout and shared summary. */
  state: GameState;
  /** Optional display names per seat (online); defaults to X / O. */
  players?: { X?: string; O?: string };
  onPlayAgain: () => void;
  onHome: () => void;
  /** Dismiss the overlay without ending the game (reveals the finished board). */
  onDismiss: () => void;
}

export function ResultOverlay({
  winner,
  state,
  players,
  onPlayAgain,
  onHome,
  onDismiss,
}: ResultOverlayProps) {
  const visible = winner !== null;
  const isDraw = winner === 'draw';
  const player = (winner === 'X' || winner === 'O' ? winner : null) as Player | null;

  const title = isDraw ? 'Draw' : player ? `${player} wins!` : '';
  const accent = player === 'X' ? palette.x : player === 'O' ? palette.o : palette.draw;
  const score = boardScore(state);

  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    Share.share({
      message: gameSummaryText(state, { players, url: SHARE_URL }),
    }).catch(() => {
      // Share dismissed / unavailable — ignore.
    });
  }, [state, players]);

  // Copy the Wordle-style emoji grid to the clipboard — handy when the share
  // sheet mangles multi-line text, and parity with the web "Copy result" button.
  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(gameSummaryText(state, { players, url: SHARE_URL }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }, [state, players]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Stop taps inside the card from dismissing. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.closeGlyph} allowFontScaling={false}>
              ×
            </Text>
          </Pressable>

          {player ? (
            <Mark player={player} size={typography.size.display} />
          ) : (
            <Text style={styles.drawGlyph} allowFontScaling={false}>
              =
            </Text>
          )}
          <Text style={[styles.title, { color: accent }]} allowFontScaling={false}>
            {title}
          </Text>

          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: palette.x }]} allowFontScaling={false}>
              {score.X}
            </Text>
            <Text style={styles.scoreDash} allowFontScaling={false}>
              –
            </Text>
            <Text style={[styles.scoreNum, { color: palette.o }]} allowFontScaling={false}>
              {score.O}
            </Text>
          </View>

          <Text style={styles.subtitle} allowFontScaling={false}>
            {isDraw ? 'Every board is full — nobody claimed a line.' : 'Three boards in a row.'}
          </Text>

          <View style={styles.actions}>
            <Button label="Play again" onPress={onPlayAgain} />
            <Button label="Share" variant="secondary" onPress={handleShare} />
            <Button
              label={copied ? 'Copied!' : 'Copy result'}
              variant="ghost"
              onPress={handleCopy}
            />
            <Button label="Home" variant="ghost" onPress={onHome} />
          </View>
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
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
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
  },
  closeGlyph: {
    fontSize: typography.size.xl,
    lineHeight: typography.size.xl,
    color: palette.muted,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  drawGlyph: {
    fontSize: typography.size.display,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.draw,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  scoreNum: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  scoreDash: {
    fontSize: typography.size.lg,
    color: palette.muted,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: space.md,
  },
  actions: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
});
