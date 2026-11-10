// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { palette } from '@mtt/theme';
import type { Difficulty } from '@mtt/engine';
import { LandingScreen } from './src/screens/LandingScreen';
import { GameScreen } from './src/screens/GameScreen';
import { JoinNameScreen } from './src/screens/JoinNameScreen';
import { OnlineMenuScreen } from './src/screens/OnlineMenuScreen';
import { OnlineGameScreen } from './src/screens/OnlineGameScreen';
import { TurnstileModal } from './src/components/TurnstileModal';
import type { Mode } from './src/useGame';
import {
  exchangeTurnstileToken,
  hasSessionToken,
  sessionTokenExpiresAt,
} from './src/online/auth';
import { loadName, saveName } from './src/online/identity';
import { parseRoomFromUrl } from './src/online/links';

type Screen =
  | { name: 'landing' }
  | { name: 'game'; mode: Mode }
  | { name: 'online-menu' }
  | { name: 'join-name'; code: string }
  | { name: 'online-game'; code: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [name, setName] = useState('');

  // Turnstile gate: the room we want to enter once a session token is minted.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  // Bumped on every freshly minted token, to schedule its refresh.
  const [tokenVersion, setTokenVersion] = useState(0);

  // Latest name for the (mount-bound) deep-link listener to read without re-subscribing.
  const nameRef = useRef(name);
  nameRef.current = name;

  const changeName = useCallback((next: string) => {
    setName(next);
    void saveName(next);
  }, []);

  // Enter a room, minting a session token first if we don't already hold one.
  const goConnect = useCallback((code: string) => {
    if (!code) return;
    if (hasSessionToken()) {
      setScreen({ name: 'online-game', code });
    } else {
      setPendingCode(code);
      setShowTurnstile(true);
    }
  }, []);

  // Mount: load the saved name, then process any room deep link (cold start), and listen for
  // links that arrive while running. A shared link routes through name-entry if no name is set.
  useEffect(() => {
    let active = true;

    const routeToJoin = (code: string, knownName: string) => {
      if (!code) return;
      if (knownName.trim()) goConnect(code);
      else setScreen({ name: 'join-name', code });
    };

    (async () => {
      const stored = await loadName();
      if (!active) return;
      if (stored) setName(stored);
      const url = await Linking.getInitialURL();
      if (!active) return;
      routeToJoin(parseRoomFromUrl(url), stored ?? '');
    })();

    const sub = Linking.addEventListener('url', ({ url }) => {
      routeToJoin(parseRoomFromUrl(url), nameRef.current);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [goConnect]);

  // While in a room, re-mint the token as it expires so the socket's later reconnects (say,
  // after the app sat in the background overnight) aren't rejected by the connect gate.
  const inRoom = screen.name === 'online-game';
  useEffect(() => {
    if (!inRoom) return;
    const expiresAt = sessionTokenExpiresAt();
    if (expiresAt === 0) return; // No token (the gate failed open) — nothing to refresh.
    const id = setTimeout(() => setShowTurnstile(true), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [inRoom, tokenVersion]);

  // --- Turnstile outcomes ----------------------------------------------------
  // Hides the challenge, then enters the room it was raised for (none for a refresh).
  const finishGate = useCallback(() => {
    setShowTurnstile(false);
    const code = pendingCode;
    setPendingCode(null);
    if (code) setScreen({ name: 'online-game', code });
  }, [pendingCode]);

  const handleTurnstileToken = useCallback(
    async (token: string) => {
      try {
        await exchangeTurnstileToken(token);
        setTokenVersion((v) => v + 1);
      } catch {
        // Minting failed — proceed anyway: the connect gate is fail-open until secrets are set,
        // and if it isn't, the room screen surfaces the rejection.
      }
      finishGate();
    },
    [finishGate],
  );

  // Render/solve failure also falls through (fail-open friendly); explicit cancel aborts.
  const handleTurnstileCancel = useCallback(() => {
    setShowTurnstile(false);
    setPendingCode(null);
  }, []);

  let content: React.ReactNode;
  switch (screen.name) {
    case 'landing':
      content = (
        <LandingScreen
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onStart={(mode) => setScreen({ name: 'game', mode })}
          name={name}
          onChangeName={changeName}
          onStartOnline={() => setScreen({ name: 'online-menu' })}
        />
      );
      break;
    case 'game':
      content = (
        <GameScreen
          // Remount on mode change so the game hook resets cleanly.
          key={screen.mode}
          mode={screen.mode}
          difficulty={difficulty}
          onHome={() => setScreen({ name: 'landing' })}
        />
      );
      break;
    case 'online-menu':
      content = (
        <OnlineMenuScreen
          name={name}
          onChangeName={changeName}
          onConnect={goConnect}
          onHome={() => setScreen({ name: 'landing' })}
        />
      );
      break;
    case 'join-name':
      content = (
        <JoinNameScreen
          code={screen.code}
          name={name}
          onChangeName={changeName}
          onJoin={() => goConnect(screen.code)}
          onBack={() => setScreen({ name: 'landing' })}
        />
      );
      break;
    case 'online-game':
      content = (
        <OnlineGameScreen
          // Remount the socket hook when the room code changes.
          key={screen.code}
          code={screen.code}
          onHome={() => setScreen({ name: 'online-menu' })}
        />
      );
      break;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      {content}
      <TurnstileModal
        visible={showTurnstile}
        onToken={handleTurnstileToken}
        onError={finishGate}
        onCancel={handleTurnstileCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
