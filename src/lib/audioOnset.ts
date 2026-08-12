export function detectMusicStart(buffer: AudioBuffer): number | null {
  const windowSize = Math.max(256, Math.round(buffer.sampleRate * 0.04));
  const windowCount = Math.ceil(buffer.length / windowSize);
  const levels = new Float32Array(windowCount);
  let peak = 0;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex++) {
    const start = windowIndex * windowSize;
    const end = Math.min(buffer.length, start + windowSize);
    let sumSquares = 0;
    let sampleCount = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let sample = start; sample < end; sample++) {
        sumSquares += samples[sample] * samples[sample];
      }
      sampleCount += end - start;
    }
    const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0;
    levels[windowIndex] = rms;
    peak = Math.max(peak, rms);
  }

  if (peak < 0.002) return null;
  const threshold = Math.max(0.006, peak * 0.08);
  const sustained = Math.max(
    3,
    Math.ceil(0.2 / (windowSize / buffer.sampleRate)),
  );
  for (let index = 0; index <= levels.length - sustained; index++) {
    let audible = 0;
    let total = 0;
    for (let next = index; next < index + sustained; next++) {
      total += levels[next];
      if (levels[next] >= threshold) audible++;
    }
    if (audible >= sustained - 1 && total / sustained >= threshold) {
      return (index * windowSize) / buffer.sampleRate;
    }
  }
  return null;
}
