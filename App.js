import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LiveWaveform from './src/components/LiveWaveform';
import { useRecorder } from './src/hooks/useRecorder';
import { formatTime } from './src/utils/audio';

export default function App() {
  const { width } = useWindowDimensions();
  const {
    levels,
    isRecording,
    durationMillis,
    permissionDenied,
    lastUri,
    start,
    pause,
    resume,
    stop,
  } = useRecorder();

  const hasSession = isRecording || durationMillis > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Enregistreur audio</Text>
      <Text style={styles.timer}>{formatTime(durationMillis)}</Text>

      <LiveWaveform levels={levels} width={width - 40} height={160} />

      {permissionDenied && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Accès au micro refusé. Autorise-le dans les réglages pour enregistrer.
          </Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.link}>Ouvrir les réglages</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        {!hasSession && <Btn label="Démarrer" onPress={start} />}
        {isRecording && <Btn label="Pause" onPress={pause} />}
        {!isRecording && hasSession && <Btn label="Reprendre" onPress={resume} />}
        {hasSession && <Btn label="Arrêter" onPress={stop} danger />}
      </View>

      {lastUri && <Text style={styles.uri}>Fichier : {lastUri}</Text>}
    </View>
  );
}

function Btn({ label, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, danger && { backgroundColor: '#d9453d' }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '600' },
  timer: { color: '#fff', fontSize: 48, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    backgroundColor: '#4f9cff',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  warning: { alignItems: 'center', gap: 6 },
  warningText: { color: '#ffb4ab', textAlign: 'center' },
  link: { color: '#4f9cff', textDecorationLine: 'underline' },
  uri: { color: '#8a8f98', fontSize: 11, textAlign: 'center' },
});