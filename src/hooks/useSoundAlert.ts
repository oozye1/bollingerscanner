import { useEffect, useRef } from 'react';

// Shared AudioContext — created once on first user interaction
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

/**
 * Loud triple-beep alert: three ascending square-wave tones.
 * Handles AudioContext suspension (browser autoplay policy).
 */
async function playAlertSound() {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const frequencies = [800, 1000, 1200];
    const beepDuration = 0.15;
    const gap = 0.1;

    for (let i = 0; i < frequencies.length; i++) {
      const startTime = now + i * (beepDuration + gap);

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequencies[i], startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(1.0, startTime + 0.01);
      gainNode.gain.setValueAtTime(1.0, startTime + beepDuration - 0.02);
      gainNode.gain.linearRampToValueAtTime(0, startTime + beepDuration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
    }
  } catch (e) {
    console.warn('Audio alert failed:', e);
  }
}

// Unlock AudioContext on first user click/touch (browser requirement)
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
}

export function useSoundAlert(trigger: any) {
  const lastTriggerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trigger) return;

    const triggerKey = JSON.stringify(trigger);
    if (triggerKey === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerKey;

    playAlertSound();
  }, [trigger]);
}
