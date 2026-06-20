import { useCallback } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import type { Player } from '@mtt/engine';
import { MetaBoard } from '../components/MetaBoard';
import { ResultOverlay } from '../components/ResultOverlay';
import { Button } from '../components/Button';
import { useOnlineGame } from '../online/useOnlineGame';

interface OnlineGameScreenProps {
  /** The room code to connect to (remounts the hook when it changes via `key`). */
  code: string;
  onHome: () => void;
}

export function OnlineGameScreen({ code, onHome }: OnlineGameScreenProps) {
  const {
    state,
    status,
    you,
    players,
    rematch,
    connected,
    code: roomCode,
    error,
    sendMove,
    sendRematch,
    leave,
  } = useOnlineGame(code);

  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - space.lg * 2, 440);

  const handleHome = useCallback(() => {
    leave();
    onHome();
  }, [leave, onHome]);

  const shareCode = useCallback(() => {
    Share.share({
      message: `Join my MetaTicTacToe game! Room code: ${roomCode}`,
    }).catch(() => {
      // Share dismissed / unavailable — ignore.
    });
  }, [roomCode]);

  // --- Lobby / waiting -------------------------------------------------------
  if (status === 'waiting') {
    return (
      <View style={styles.container}>
        <TopBar onHome={handleHome} />
        <View style={styles.lobbyBody}>
          <Text style={styles.lobbyTitle} allowFontScaling={false}>
            Waiting for opponent…
          </Text>
          <Text style={styles.lobbySub} allowFontScaling={false}>
            Share this code so a friend can join.
          </Text>

          <Pressable onPress={shareCode} style={styles.codeChip} hitSlop={8}>
            <Text style={styles.codeChipText} allowFontScaling={false}>
              {roomCode}
            </Text>
            <Text style={styles.codeChipHint} allowFontScaling={false}>
              Tap to share
            </Text>
          </Pressable>

          <Text style={styles.connNote} allowFontScaling={false}>
            {connected ? 'Connected to room' : 'Connecting…'}
          </Text>
          {error ? (
            <Text style={styles.errorNote} allowFontScaling={false}>
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button label="Cancel" variant="ghost" onPress={handleHome} />
        </View>
      </View>
    );
  }

  // --- Playing / ended -------------------------------------------------------
  const current = state.currentPlayer;
  const turnColor = current === 'X' ? palette.x : palette.o;
  const turnSoft = current === 'X' ? palette.xSoft : palette.oSoft;

  const nameOf = (seat: Player): string =>
    players[seat]?.name?.trim() || `Player ${seat}`;
  const opponentSeat: Player | null = you ? (you === 'X' ? 'O' : 'X') : null;
  const opponent = opponentSeat ? players[opponentSeat] : undefined;

  const yourTurn = status === 'playing' && you !== null && current === you;
  const boardLocked = !(yourTurn && connected);

  // Connection note priority: my socket down > opponent gone.
  let connNote: string | null = null;
  if (!connected) connNote = 'Reconnecting…';
  else if (opponent && !opponent.connected) connNote = 'Opponent disconnected…';

  const forced = state.activeBoard !== null && !state.winner;
  let statusLine: string;
  if (state.winner) statusLine = 'Game over';
  else if (!you) statusLine = 'Joining…';
  else if (yourTurn) statusLine = forced ? 'Play in the highlighted board' : 'Play anywhere';
  else statusLine = `Waiting for ${opponentSeat ? nameOf(opponentSeat) : 'opponent'}…`;

  const turnText = state.winner
    ? 'Game over'
    : yourTurn
      ? 'Your move'
      : `${current === you ? 'You' : nameOf(current)} to move`;

  // Rematch: show "Waiting…" once we've asked but the other side hasn't.
  const youAsked = you ? rematch[you] : false;
  const oppAsked = opponentSeat ? rematch[opponentSeat] : false;
  const rematchPending = youAsked && !oppAsked;

  return (
    <View style={styles.container}>
      <TopBar onHome={handleHome} />

      {/* Players header */}
      <View style={styles.playersRow}>
        <SeatBadge
          label={nameOf('X')}
          seat="X"
          isYou={you === 'X'}
          active={current === 'X' && !state.winner}
          connected={players.X?.connected ?? false}
        />
        <Text style={styles.vsText} allowFontScaling={false}>
          vs
        </Text>
        <SeatBadge
          label={nameOf('O')}
          seat="O"
          isYou={you === 'O'}
          active={current === 'O' && !state.winner}
          connected={players.O?.connected ?? false}
          alignEnd
        />
      </View>

      {/* Turn indicator + status */}
      <View style={styles.statusBlock}>
        <View style={[styles.turnPill, { backgroundColor: turnSoft }]}>
          <View style={[styles.turnDot, { backgroundColor: turnColor }]} />
          <Text style={[styles.turnText, { color: turnColor }]} allowFontScaling={false}>
            {turnText}
          </Text>
        </View>
        <Text style={styles.statusText} allowFontScaling={false}>
          {connNote ?? statusLine}
        </Text>
      </View>

      {/* Board (locked unless it's your turn and you're connected) */}
      <View style={styles.boardWrap} pointerEvents={boardLocked ? 'none' : 'auto'}>
        <MetaBoard state={state} width={boardWidth} onPressCell={sendMove} />
      </View>

      {error ? (
        <Text style={styles.errorNote} allowFontScaling={false}>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer} />

      {/* Result + rematch. The "Play again" button asks for a rematch; once we've
          asked (but the opponent hasn't), a pending notice layers over the overlay. */}
      <ResultOverlay
        winner={state.winner}
        onPlayAgain={sendRematch}
        onHome={handleHome}
      />
      <Modal
        visible={Boolean(state.winner) && rematchPending}
        transparent
        animationType="fade"
        onRequestClose={handleHome}
      >
        <View style={styles.rematchBackdrop} pointerEvents="box-none">
          <View style={styles.rematchCard}>
            <Text style={styles.rematchText} allowFontScaling={false}>
              Waiting for opponent to accept rematch…
            </Text>
            <Button label="Cancel" variant="ghost" onPress={handleHome} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TopBar({ onHome }: { onHome: () => void }) {
  return (
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
  );
}

function SeatBadge({
  label,
  seat,
  isYou,
  active,
  connected,
  alignEnd,
}: {
  label: string;
  seat: Player;
  isYou: boolean;
  active: boolean;
  connected: boolean;
  alignEnd?: boolean;
}) {
  const color = seat === 'X' ? palette.x : palette.o;
  return (
    <View style={[styles.seatBadge, alignEnd && styles.seatBadgeEnd]}>
      <View style={styles.seatNameRow}>
        <View
          style={[
            styles.seatDot,
            { backgroundColor: connected ? color : palette.muted },
          ]}
        />
        <Text
          style={[styles.seatName, active && { color }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {label}
          {isYou ? ' (you)' : ''}
        </Text>
      </View>
      <Text style={[styles.seatSeat, { color }]} allowFontScaling={false}>
        {seat}
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

  // Lobby
  lobbyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  lobbyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
  },
  lobbySub: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  codeChip: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    gap: space.xs,
  },
  codeChipText: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
    letterSpacing: 8,
  },
  codeChipHint: {
    fontSize: typography.size.xs,
    color: palette.muted,
    letterSpacing: 0.5,
  },
  connNote: {
    fontSize: typography.size.sm,
    color: palette.muted,
    marginTop: space.sm,
  },
  errorNote: {
    fontSize: typography.size.sm,
    color: palette.danger,
    textAlign: 'center',
    paddingVertical: space.xs,
  },

  // Players header
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.md,
  },
  vsText: {
    fontSize: typography.size.sm,
    color: palette.muted,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  seatBadge: {
    flex: 1,
    gap: 2,
  },
  seatBadgeEnd: {
    alignItems: 'flex-end',
  },
  seatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: '100%',
  },
  seatDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  seatName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
    color: palette.ink,
    flexShrink: 1,
  },
  seatSeat: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },

  // Turn + status
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
    paddingVertical: space.lg,
  },

  rematchBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: space.xl,
  },
  rematchCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    gap: space.sm,
    alignItems: 'center',
    shadowColor: shadow.card.shadowColor,
    shadowOpacity: shadow.card.shadowOpacity,
    shadowRadius: shadow.card.shadowRadius,
    shadowOffset: shadow.card.shadowOffset,
    elevation: shadow.card.elevation,
  },
  rematchText: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    textAlign: 'center',
  },
});
