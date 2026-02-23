import { useEffect, useRef, useCallback } from 'react';

/**
 * Generates a loud, attention-grabbing trading alert using Web Audio API.
 * Plays a triple-beep pattern: three ascending tones.
 */
function playAlertSound(volume: number = 1.0) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Three ascending beeps: 800Hz, 1000Hz, 1200Hz
    const frequencies = [800, 1000, 1200];
    const beepDuration = 0.12;
    const gap = 0.08;

    for (let i = 0; i < frequencies.length; i++) {
      const startTime = now + i * (beepDuration + gap);

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequencies[i], startTime);

      // Sharp attack, sustain, quick release
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.setValueAtTime(volume, startTime + beepDuration - 0.02);
      gainNode.gain.linearRampToValueAtTime(0, startTime + beepDuration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
    }

    // Clean up context after sound finishes
    const totalDuration = frequencies.length * (beepDuration + gap);
    setTimeout(() => ctx.close(), (totalDuration + 0.5) * 1000);
  } catch (e) {
    console.log('Audio alert failed:', e);
  }
}

export function useSoundAlert(trigger: any) {
  const lastTriggerRef = useRef<string | null>(null);

  const play = useCallback(() => {
    playAlertSound(1.0); // Full volume
  }, []);

  useEffect(() => {
    if (!trigger) return;

    // Deduplicate: only play if trigger changed
    const triggerKey = JSON.stringify(trigger);
    if (triggerKey === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerKey;

    play();
  }, [trigger, play]);
}
