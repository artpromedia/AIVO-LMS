import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";

export function useAudio() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback(async (uri: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      setIsPlaying(true);
      await sound.playAsync();
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  return { play, stop, cleanup, isPlaying };
}
