// apps/mobile/App.tsx

import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// This is required for Expo Router on web
const ctx = require.context('./app');

function App() {
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
