export const LANDING_DISPLAY_BPM = 148;
export const LANDING_SOURCE_BPM = 150;
export const LANDING_FIRST_BEAT_SECONDS = 0.312;
export const LANDING_SLOGAN_CHARACTERS = 16;
export const LANDING_BEAT_EVENT = "dance-manager:landing-beat";

export const LANDING_VIDEO_PLAYBACK_RATE =
  LANDING_DISPLAY_BPM / LANDING_SOURCE_BPM;

export function landingCharacterAt(sourceTime: number) {
  const sourceBeatDuration = 60 / LANDING_SOURCE_BPM;
  const beat = Math.floor(
    (sourceTime - LANDING_FIRST_BEAT_SECONDS) / sourceBeatDuration,
  );
  return ((beat % LANDING_SLOGAN_CHARACTERS) + LANDING_SLOGAN_CHARACTERS) %
    LANDING_SLOGAN_CHARACTERS;
}
