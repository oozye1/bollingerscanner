import { useEffect, useRef } from 'react';

export function useSoundAlert(trigger: any) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element once
    if (!audioRef.current) {
      // Simple chime sound (data URI to avoid external dependencies if possible, or use a public URL)
      // Using a short pleasant chime sound from a public CDN or similar would be ideal.
      // For now, let's use a generated beep or a placeholder. 
      // Actually, a data URI is safest for "no external assets".
      // This is a short "ding" sound.
      audioRef.current = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav");
      audioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    if (trigger && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Audio play failed (user interaction needed first):", e));
    }
  }, [trigger]);
}
