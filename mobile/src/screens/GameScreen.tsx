import { useWindowDimensions } from 'react-native';
import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';
import type { Difficulty } from '@mtt/engine';
import { MetaBoard } from '../components/MetaBoard';
import { ResultOverlay } from '../components/ResultOverlay';
import { useGame, type Mode } from '../useGame';

interface GameScreenProps {
  mode: Mode;
  difficulty: Difficulty;
  onHome: () => void;
}

export function GameScreen({ mode, difficulty, onHome }: GameScreenProps) {
  const { state, thinking, play, newGame } = useGame(mode, difficulty);
  const { width } = useWindowDimensions();

  // The meta board fills the screen width, capped for large screens.
  const boardWidth = Math.min(width - space.lg * 2, 440);

  const current = state.currentPlayer;
  const turnColor = current === 'X' ? palette.x : palette.o;
  const turnSoft = current === 'X' ? palette.xSoft : palette.oSoft;

  const forced = state.activeBoard !== null && !state.winner;
  const statusLine = state.winner
    ? 'Game over'
    : forced
      ? 'Play in the highlighted board'
      : 'Play anywhere';

  const showThinking = mode === 'vs-computer' && thinking && !state.winner;

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
          {mode === 'vs-computer'
            ? `vs Computer · ${difficulty === 'easy' ? 'Easy' : 'Hard'}`
            : '2 Players'}
        </Text>
      </View>

      {/* Turn indicator + status */}
      <View style={styles.statusBlock}>
        <View style={[styles.turnPill, { backgroundColor: turnSoft }]}>
          <View style={[styles.turnDot, { backgroundColor: turnColor }]} />
          <Text
            style={[styles.turnText, { color: turnColor }]}
            allowFontScaling={false}
          >
            {showThinking ? 'Computer thinking…' : `${current} to move`}
          </Text>
        </View>
        <Text style={styles.statusText} allowFontScaling={false}>
          {statusLine}
        </Text>
      </View>

      {/* Board */}
      <View style={styles.boardWrap} pointerEvents={showThinking ? 'none' : 'auto'}>
        <MetaBoard state={state} width={boardWidth} onPressCell={play} />
      </View>

      {/* New game */}
      <View style={styles.footer}>
        <Pressable onPress={newGame} style={styles.newGameBtn} hitSlop={8}>
          <Text style={styles.newGameText} allowFontScaling={false}>
            New game
          </Text>
        </Pressable>
      </View>

      <ResultOverlay winner={state.winner} onPlayAgain={newGame} onHome={onHome} />
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
  statusBlock: {
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  turnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  turnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
  },
  statusText: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
  },
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  newGameBtn: {
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.surface,
  },
  newGameText: {
    fontSize: typography.size.sm,
    color: palette.ink,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
  },
});
