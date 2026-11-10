// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import { boardScore, type Player } from '@mtt/engine';
import { HelpButton } from '../components/HelpButton';
import { MatchStats } from '../components/MatchStats';
import { MetaBoard } from '../components/MetaBoard';
import { ResultOverlay } from '../components/ResultOverlay';
import { Score } from '../components/Score';
import { Button } from '../components/Button';
import { roomShareUrl } from '../online/links';
import { useOnlineGame } from '../online/useOnlineGame';

/** ~14% tint of `palette.danger` (#E5484D) for the urgent move-timer background. */
const URGENT_TIMER_BG = 'rgba(229, 72, 77, 0.14)';

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
    turnDeadline,
    claimableAt,
    forfeit,
    error,
    sendMove,
    sendRematch,
    sendClaim,
    leave,
  } = useOnlineGame(code);

  const { width } = useWindowDimensions();
  const boardWidth = Math.min(width - space.lg * 2, 420);

  // Whether the user has dismissed the end-of-game overlay (game stays over).
  // Resets automatically once a rematch starts (the winner clears).
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => {
    if (!state.winner) setResultDismissed(false);
  }, [state.winner]);

  const [codeCopied, setCodeCopied] = useState(false);

  const handleHome = useCallback(() => {
    leave();
    onHome();
  }, [leave, onHome]);

  const shareCode = useCallback(() => {
    Share.share({
      message: `Join my MetaTicTacToe game! Room code: ${roomCode}\n${roomShareUrl(roomCode)}`,
    }).catch(() => {
      // Share dismissed / unavailable — ignore.
    });
  }, [roomCode]);

  const copyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
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

          <Pressable
            onPress={shareCode}
            style={styles.codeChip}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Room code ${roomCode}. Tap to share.`}
          >
            <Text style={styles.codeChipText} allowFontScaling={false}>
              {roomCode}
            </Text>
            <Text style={styles.codeChipHint} allowFontScaling={false}>
              Tap to share
            </Text>
          </Pressable>

          <View style={styles.lobbyActions}>
            <Button label="Share invite" variant="secondary" onPress={shareCode} />
            <Button
              label={codeCopied ? 'Copied!' : 'Copy code'}
              variant="ghost"
              onPress={copyCode}
            />
          </View>

          <Text style={styles.connNote} allowFontScaling={false}>
            {connected ? 'Connected to room' : 'Connecting…'}
          </Text>
          {error ? (
            <Text style={styles.errorNote} allowFontScaling={false}>
              {error}
            </Text>
          ) : null}

          <Text style={styles.finePrint} allowFontScaling={false}>
            Inactive rooms are freed after 6 hours.
          </Text>
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

  // When over, surface the result + score (e.g. "Alice (X) wins! · X 4–2 O").
  const score = boardScore(state);
  let resultText: string | null = null;
  if (state.winner === 'draw') resultText = 'Draw';
  else if (state.winner === 'X') resultText = `${nameOf('X')} wins!`;
  else if (state.winner === 'O') resultText = `${nameOf('O')} wins!`;
  const overLine = resultText ? `${resultText} · X ${score.X}–${score.O} O` : null;

  const forced = state.activeBoard !== null && !state.winner;
  let statusLine: string;
  if (overLine) statusLine = overLine;
  else if (!you) statusLine = 'Joining…';
  else if (yourTurn) statusLine = forced ? 'Play in the highlighted board' : 'Play anywhere';
  else statusLine = `Waiting for ${opponentSeat ? nameOf(opponentSeat) : 'opponent'}…`;

  const turnText = resultText
    ? resultText
    : yourTurn
      ? 'Your move'
      : `${current === you ? 'You' : nameOf(current)} to move`;

  // Rematch: show "Waiting…" once we've asked but the other side hasn't; otherwise say
  // whether the opponent has asked, or has left.
  const youAsked = you ? rematch[you] : false;
  const oppAsked = opponentSeat ? rematch[opponentSeat] : false;
  const rematchPending = youAsked && !oppAsked;
  const opponentName = opponentSeat ? nameOf(opponentSeat) : 'Your opponent';
  const opponentOnline = opponent?.connected ?? false;
  const rematchLabel = oppAsked && !youAsked ? 'Accept rematch' : 'Rematch';
  let rematchNote: string | undefined;
  if (state.winner && !youAsked) {
    if (!opponentOnline) rematchNote = `${opponentName} has left the room.`;
    else if (oppAsked) rematchNote = `${opponentName} wants a rematch!`;
  }
  const forfeitNote = forfeit ? `${nameOf(forfeit)} left the game.` : undefined;

  // Opponent offline mid-game: after a grace period we may end it as a win by forfeit.
  const canClaim = status === 'playing' && connected && opponent !== undefined && !opponentOnline;

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
        <Score state={state} />
        <SeatBadge
          label={nameOf('O')}
          seat="O"
          isYou={you === 'O'}
          active={current === 'O' && !state.winner}
          connected={players.O?.connected ?? false}
          alignEnd
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Turn indicator + status */}
        <View style={styles.statusBlock}>
          {state.winner ? (
            <View style={[styles.turnPill, { backgroundColor: palette.surfaceAlt }]}>
              <Text style={[styles.turnText, { color: palette.ink }]} allowFontScaling={false}>
                {turnText}
              </Text>
            </View>
          ) : (
            <View style={[styles.turnPill, { backgroundColor: turnSoft }]}>
              <View style={[styles.turnDot, { backgroundColor: turnColor }]} />
              <Text style={[styles.turnText, { color: turnColor }]} allowFontScaling={false}>
                {turnText}
              </Text>
            </View>
          )}
          {!state.winner && status === 'playing' && turnDeadline !== null ? (
            <MoveTimer deadline={turnDeadline} seat={current} />
          ) : null}
          <Text style={styles.statusText} allowFontScaling={false}>
            {connNote ?? statusLine}
          </Text>
          {canClaim && claimableAt !== null ? (
            <ClaimWin claimableAt={claimableAt} onClaim={sendClaim} />
          ) : null}
          {state.winner && forfeitNote ? (
            <Text style={styles.statusText} allowFontScaling={false}>
              {forfeitNote}
            </Text>
          ) : null}
          {/* With the result overlay closed, keep the rematch reachable here. */}
          {state.winner && resultDismissed && !youAsked ? (
            <>
              <View style={styles.statusActions}>
                <Button label={rematchLabel} variant="secondary" onPress={sendRematch} />
                <Button
                  label="Show result"
                  variant="ghost"
                  onPress={() => setResultDismissed(false)}
                />
              </View>
              {rematchNote ? (
                <Text style={styles.statusText} allowFontScaling={false}>
                  {rematchNote}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Board (locked unless it's your turn and you're connected) */}
        <View style={styles.boardWrap} pointerEvents={boardLocked ? 'none' : 'auto'}>
          <MetaBoard state={state} width={boardWidth} onPressCell={sendMove} />
        </View>

        {/* Live match stats */}
        <MatchStats state={state} names={{ X: players.X?.name, O: players.O?.name }} you={you} />

        {error ? (
          <Text style={styles.errorNote} allowFontScaling={false}>
            {error}
          </Text>
        ) : null}

        <Text style={styles.finePrint} allowFontScaling={false}>
          Inactive rooms are freed after 6 hours.
        </Text>
      </ScrollView>

      {/* Result + rematch. The "Play again" button asks for a rematch; once we've
          asked (but the opponent hasn't), a pending notice layers over the overlay. */}
      <ResultOverlay
        winner={resultDismissed ? null : state.winner}
        state={state}
        players={{ X: players.X?.name, O: players.O?.name }}
        onPlayAgain={sendRematch}
        onHome={handleHome}
        onDismiss={() => setResultDismissed(true)}
        playAgainLabel={rematchLabel}
        note={rematchNote}
        subtitle={forfeitNote}
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
              {opponentOnline
                ? 'Waiting for opponent to accept rematch…'
                : `Waiting for ${opponentName} to come back…`}
            </Text>
            <Button label="Cancel" variant="ghost" onPress={handleHome} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Live countdown for the current move, ticking once a second off the server's
 * absolute `deadline`. Informational only — the server auto-plays an `easy` move
 * when it lapses, and each `sync` re-supplies the deadline so this self-corrects.
 */
function MoveTimer({ deadline, seat }: { deadline: number; seat: Player }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const remaining = Math.max(0, deadline - now);
  const totalSec = Math.ceil(remaining / 1000);
  const label = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
  const urgent = remaining <= 15_000;
  const color = urgent ? palette.danger : seat === 'X' ? palette.x : palette.o;
  const bg = urgent ? URGENT_TIMER_BG : seat === 'X' ? palette.xSoft : palette.oSoft;

  return (
    <View style={[styles.moveTimer, { backgroundColor: bg }]}>
      <Text style={[styles.moveTimerTime, { color }]} allowFontScaling={false}>
        {label}
      </Text>
      <Text style={[styles.moveTimerUnit, { color }]} allowFontScaling={false}>
        left
      </Text>
    </View>
  );
}

/**
 * Shown to the player left behind while their opponent is offline mid-game: counts down the
 * grace period, then offers to end the game as a win by forfeit. The server re-checks the time.
 */
function ClaimWin({ claimableAt, onClaim }: { claimableAt: number; onClaim: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.ceil((claimableAt - now) / 1000);
  if (seconds > 0) {
    return (
      <Text style={styles.statusText} allowFontScaling={false}>
        If they don’t return, you can claim the win in {seconds}s.
      </Text>
    );
  }
  return (
    <View style={styles.statusActions}>
      <Button label="Claim win" onPress={onClaim} />
    </View>
  );
}

function TopBar({ onHome }: { onHome: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onHome}
        hitSlop={10}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
      >
        <Text style={styles.backText} allowFontScaling={false}>
          ‹ Home
        </Text>
      </Pressable>
      <View style={styles.topBarRightGroup}>
        <Text style={styles.modeLabel} allowFontScaling={false}>
          Online
        </Text>
        <HelpButton />
      </View>
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
  topBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  lobbyActions: {
    alignSelf: 'stretch',
    gap: space.sm,
    paddingHorizontal: space.xl,
    marginTop: space.xs,
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
  finePrint: {
    fontSize: typography.size.xs,
    color: palette.muted,
    textAlign: 'center',
  },

  // Players header
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.md,
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

  // Scrollable play area
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space.lg,
    paddingBottom: space.lg,
  },

  // Turn + status
  statusBlock: {
    alignItems: 'center',
    gap: space.sm,
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
  moveTimer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  moveTimerTime: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    fontVariant: ['tabular-nums'],
  },
  moveTimerUnit: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
    opacity: 0.7,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  statusText: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
  },

  boardWrap: {
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
