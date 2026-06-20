import { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { palette } from '@mtt/theme';
import type { Difficulty } from '@mtt/engine';
import { LandingScreen } from './src/screens/LandingScreen';
import { GameScreen } from './src/screens/GameScreen';
import { OnlineMenuScreen } from './src/screens/OnlineMenuScreen';
import { OnlineGameScreen } from './src/screens/OnlineGameScreen';
import type { Mode } from './src/useGame';
import { loadName, saveName } from './src/online/identity';

type Screen =
  | { name: 'landing' }
  | { name: 'game'; mode: Mode }
  | { name: 'online-menu' }
  | { name: 'online-game'; code: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [name, setName] = useState('');

  // Load the persisted display name once on mount.
  useEffect(() => {
    let active = true;
    loadName().then((stored) => {
      if (active && stored) setName(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const changeName = (next: string) => {
    setName(next);
    void saveName(next);
  };

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
          onConnect={(code) => setScreen({ name: 'online-game', code })}
          onHome={() => setScreen({ name: 'landing' })}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
