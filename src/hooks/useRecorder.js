import { useEffect, useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { dbToLevel } from '../utils/audio';

export const MAX_POINTS = 60; // taille fixe du tampon affiché

export function useRecorder() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  // état rafraîchi toutes les 50 ms (≈ 20 images/s)
  const state = useAudioRecorderState(recorder, 50);

  const [levels, setLevels] = useState(() => Array(MAX_POINTS).fill(0));
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastUri, setLastUri] = useState(null);

  // À chaque nouvelle mesure, on pousse le niveau dans le tampon glissant
  useEffect(() => {
    if (!state.isRecording) return;
    const level = dbToLevel(state.metering);
    setLevels((prev) => [...prev.slice(1), level]);
  }, [state.durationMillis]);

  async function start() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setLevels(Array(MAX_POINTS).fill(0));
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  function pause() {
    recorder.pause();
  }

  function resume() {
    recorder.record();
  }

  async function stop() {
    await recorder.stop();
    setLastUri(recorder.uri);
    await setAudioModeAsync({ allowsRecording: false });
  }

  return {
    levels,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    permissionDenied,
    lastUri,
    start,
    pause,
    resume,
    stop,
  };
}