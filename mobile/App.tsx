import { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { palette } from '@mtt/theme';
import type { Difficulty } from '@mtt/engine';
import { LandingScreen } from './src/screens/LandingScreen';
import { GameScreen } from './src/screens/GameScreen';
import type { Mode } from './src/useGame';

type Screen = { name: 'landing' } | { name: 'game'; mode: Mode };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      {screen.name === 'landing' ? (
        <LandingScreen
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onStart={(mode) => setScreen({ name: 'game', mode })}
        />
      ) : (
        <GameScreen
          // Remount on mode change so the game hook resets cleanly.
          key={screen.mode}
          mode={screen.mode}
          difficulty={difficulty}
          onHome={() => setScreen({ name: 'landing' })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
