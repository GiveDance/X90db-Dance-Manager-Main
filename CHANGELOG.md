# Changelog

This changelog documents the product work completed after DanceManager was created from the DancePlayer codebase.

## [1.1.0] - 2026-08-11

### Product foundation

- Rebranded the copied application as DanceManager across package metadata, documentation, and the web manifest.
- Replaced the original DancePlayer documentation with a DanceManager product overview, workflow, privacy model, and development instructions.
- Preserved a fully local-first architecture: video, analysis results, calibration, sections, and hints remain in the browser.

### Local dance library and persistence

- Added a persistent local dance library backed by IndexedDB.
- Stored video bytes separately from dance metadata for more reliable updates.
- Replaced Blob/File persistence with ArrayBuffer-backed video records to support embedded WebKit environments that abort IndexedDB Blob writes.
- Retained compatibility with legacy Blob-backed records.
- Added IndexedDB connection recovery, transaction timeouts, bounded retries, stale-transaction cleanup, and serialized metadata writes.
- Decoupled playback from background video persistence so large local saves do not block entry into the player.
- Added saved-video covers, duration, BPM, update time, hint count, export, and deletion actions.

### Automatic rhythm analysis

- Added automatic music-onset, BPM, and beat-offset analysis during upload.
- Added full-track Web Audio decoding and `web-audio-beat-detector` analysis.
- Added browser-media PCM capture for MOV/MP4 containers that cannot be decoded reliably with `decodeAudioData`.
- Added a local energy-envelope autocorrelation estimator when third-party BPM detection fails.
- Corrected sampled-audio timing against actual media duration.
- Added segmented 1x probing for embedded WebKit, avoiding zero-amplitude analyzer data produced by accelerated muted playback.
- Kept 120 BPM only as a final fallback when usable audio cannot be analyzed.
- Added automatic migration for older saved videos that do not contain onset or original-analysis metadata.
- Added canonical rhythm metadata so stale tabs cannot overwrite newer analyzed or calibrated BPM and offset values.
- Added immutable first-analysis BPM and offset values for reliable calibration reset behavior.

### Rhythm visualization

- Added selectable dot and tile count-point visualizations.
- Added edge pulse and breath-light visualization modes.
- Added configurable count-point placement at the top, bottom, left, or right of the video.
- Added a neutral grayscale pre-music state for dots, tiles, pulse, and breath modes.
- Preserved the original beat cadence, flash timing, pulse decay, and breath scaling before music entry; only the color state changes.
- Kept beat progression active during the grayscale state instead of freezing the first beat.
- Corrected the grayscale first-beat/resting-beat visual hierarchy without changing the normal color state.
- Removed blue leakage from grayscale pulse and count-in states.
- Added consistent runtime and exported-video visualization behavior.

### Eight-count navigation and practice loops

- Added derived eight-count segmentation based on BPM, beat offset, and video duration.
- Added previous and next eight-count controls.
- Added List and Tile navigation views.
- Added active-eight-count tracking and automatic list scrolling.
- Added per-eight-count looping.
- Added `5-6-7-8` visual preparation count-ins before eight-count playback and loop playback.
- Added clear loop status and cancellation controls.
- Preserved loop behavior while switching between eight-count and section workflows.

### Dance sections

- Added automatic dance-section detection.
- Added a dedicated Sections tab alongside the Eight-count tab.
- Added contiguous multi-selection of eight-counts for creating sections.
- Added validation and disabled states for non-contiguous selections.
- Added manual section creation, editing, deletion, and naming.
- Stored section boundaries by eight-count index so sections remain aligned after rhythm calibration.
- Added section playback and looping with preparation count-ins.
- Added a section timeline with seeking, resizing, creation, and loop cancellation.
- Added List and Tile view consistency across section-related controls.

### Action hints

- Combined the original danmaku and marker controls into an Action Hints workflow.
- Added a display-hints toggle and a dedicated Add Hint form.
- Added editable hint time using seconds or `mm:ss`.
- Added short hint text, description, and color selection.
- Defaulted new hint time to the current playback position.
- Added hint display, persistence, deletion, section association, and exported-video rendering.
- Split display and add actions inside the compact More menu.
- Added checkbox states for Mirror Practice and Display Hints without dismissing the More menu.

### Rhythm calibration

- Added direct BPM entry, one-BPM decrement/increment controls, and full-width tap tempo.
- Added editable first-beat time in seconds with `-1 beat` and `+1 beat` adjustments.
- Added a full-width Set to Current Frame action.
- Added live current-beat feedback for visual alignment.
- Added reset to the immutable values produced by the video's first successful analysis.
- Moved calibration from the bottom player controls into the Dance Sections header, aligned with the Eight-count/Sections tabs.
- Removed calibration from the compact More menu.
- Automatically opens calibration one second after a newly uploaded video first enters the player.
- Cancels delayed automatic opening when the user interacts with calibration first.
- Keeps calibration closed when reopening an existing library item.

### Player controls and responsive behavior

- Reworked the control bar around container width rather than viewport width.
- Added compact and extra-narrow layouts that preserve core playback actions down to a 360 px player width.
- Moved Mirror Practice and Action Hint management into More when space is constrained.
- Kept visualization, playback rate, volume, and More controls accessible in compact layouts.
- Replaced the native playback-rate select with a consistent button that always displays the current rate.
- Changed playback-rate options to open on hover while retaining click and keyboard access.
- Reduced volume entry to a single mute/unmute icon button.
- Added a hover-activated vertical volume control with a live percentage value.
- Added adaptive time readouts that shorten or hide only when required to prevent overflow.
- Added consistent dark hover tooltips for every icon-only button, including keyboard-focus support.
- Improved menu spacing, alignment, active states, checkbox states, focus rings, and viewport-safe positioning.

### Export

- Added local video export without a backend.
- Added optional mirror, beat visualization, action hint, and count-in overlays.
- Added export progress, cancellation, completion, and unsupported-browser states.
- Kept exported rhythm visualization synchronized with runtime onset and calibration behavior.

### Reliability and compatibility fixes

- Fixed delayed, repeated, skipped, and premature visual beat transitions introduced by earlier pre-music color handling.
- Fixed incorrect use of beat offset as music onset by introducing a separate music-start signal.
- Fixed old records missing music-start metadata by analyzing them when opened.
- Fixed local metadata races caused by ordinary autosaves and stale open tabs.
- Fixed hidden media readiness and bounded `play()` retry behavior during fallback analysis.
- Fixed control-row overflow at compact widths.
- Fixed hint and calibration popovers overflowing narrow player regions or short viewports.
- Fixed duplicate and misplaced section controls, timestamps, and loop actions.
- Fixed calibration reset so it restores the video's original analyzed values rather than the most recently calibrated values.

