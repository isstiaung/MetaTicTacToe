import { Modal, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import type { Outcome, Player } from '@mtt/engine';
import { Button } from './Button';
import { Mark } from './Mark';

interface ResultOverlayProps {
  /** Non-null winner shows the overlay; null hides it. */
  winner: Outcome;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultOverlay({ winner, onPlayAgain, onHome }: ResultOverlayProps) {
  const visible = winner !== null;
  const isDraw = winner === 'draw';
  const player = (winner === 'X' || winner === 'O' ? winner : null) as Player | null;

  const title = isDraw ? 'Draw' : player ? `${player} wins!` : '';
  const accent = player === 'X' ? palette.x : player === 'O' ? palette.o : palette.draw;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onHome}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
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
          <Text style={styles.subtitle} allowFontScaling={false}>
            {isDraw ? 'Every board is full — nobody claimed a line.' : 'Three boards in a row.'}
          </Text>

          <View style={styles.actions}>
            <Button label="Play again" onPress={onPlayAgain} />
            <Button label="Home" variant="ghost" onPress={onHome} />
          </View>
        </View>
      </View>
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
  drawGlyph: {
    fontSize: typography.size.display,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.draw,
  },
  title: {
    fontSize: typography.size.xl,
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
