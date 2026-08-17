export const MUSIC_START_TOLERANCE_SECONDS = 0.02;

export function hasMusicStarted(
  time: number,
  musicStart: number | null,
): boolean {
  return (
    musicStart == null ||
    time >= musicStart - MUSIC_START_TOLERANCE_SECONDS
  );
}

/**
 * Returns the preparation count that leads directly into the detected music
 * start. The count disappears at the same instant the beat UI turns colorful.
 */
export function musicStartCountIn(
  time: number,
  bpm: number,
  musicStart: number | null,
): 5 | 6 | 7 | 8 | null {
  return musicStartPreRoll(time, bpm, musicStart)?.count ?? null;
}

export function musicStartPreRoll(
  time: number,
  bpm: number,
  musicStart: number | null,
): { count: 5 | 6 | 7 | 8; phase: number } | null {
  if (
    musicStart == null ||
    musicStart <= MUSIC_START_TOLERANCE_SECONDS ||
    !Number.isFinite(bpm) ||
    bpm <= 0 ||
    hasMusicStarted(time, musicStart)
  ) {
    return null;
  }

  const secondsPerBeat = 60 / bpm;
  const remaining = musicStart - time;
  if (remaining > secondsPerBeat * 4 + MUSIC_START_TOLERANCE_SECONDS) {
    return null;
  }
  const beatsUntilStart = Math.max(
    1,
    Math.min(4, Math.ceil(remaining / secondsPerBeat)),
  );
  return {
    count: (9 - beatsUntilStart) as 5 | 6 | 7 | 8,
    phase: Math.max(
      0,
      Math.min(1, beatsUntilStart - remaining / secondsPerBeat),
    ),
  };
}

export function trackedBeatPreRoll(
  time: number,
  countdownBeats: number[],
): {
  count: 5 | 6 | 7 | 8;
  duration: number;
  phase: number;
} | null {
  if (
    countdownBeats.length !== 5 ||
    time < countdownBeats[0] ||
    time >= countdownBeats[4]
  ) {
    return null;
  }

  let index = 0;
  while (index < 3 && time >= countdownBeats[index + 1]) index++;
  const start = countdownBeats[index];
  const end = countdownBeats[index + 1];
  const duration = end - start;
  if (!Number.isFinite(duration) || duration <= 0) return null;

  return {
    count: (5 + index) as 5 | 6 | 7 | 8,
    duration,
    phase: Math.max(0, Math.min(1, (time - start) / duration)),
  };
}
