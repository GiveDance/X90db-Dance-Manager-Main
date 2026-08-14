# Changelog

- Added a full-screen, muted monochrome video landing experience with a custom retro CRT WebGL shader and mode-specific entry CTAs.

This changelog documents the product work completed after DanceManager was created from the DancePlayer codebase.

## [Unreleased] - 2026-08-13

### Home

- Reorganized the homepage into concise Chinese mode tabs, a differentiated upload surface, a shared project library, and lower-priority early-access features.
- Unified Learning and Performing project cards with linked state buttons and bidirectional project generation that reuses stored media and rhythm data.
- Added development-status entry cards for the motion calibrator and mobile/Apple Watch beat vibration companion.

### Performing workspace

- Restructured the Performing sidebar into a 3:2 material-settings and material-library layout consistent with the Learning Player.
- Split the composition timeline into a full-duration Overlay track above the Composition track.
- Moved performer-signal settings from the material library into the selectable Overlay timeline material.
- Presented uploaded clips and the four existing generated-stage templates as reusable library materials without changing their rendering logic.
- Added the shared timeline zoom and horizontal-scroll controls and removed redundant duration summary information.
- Reused the Learning Player transport styling with precise previous/next small-beat navigation, keyboard shortcuts, playback rate, and volume controls.
- Matched the preview canvas to the uploaded source video's aspect ratio and promoted the workspace header to span the full page above the sidebar.
- Converted uploaded videos and generated-stage templates into draggable, non-overlapping Composition materials.
- Added reusable video assets with thumbnails, independent timeline instances, Delete-key removal, source-aware trimming, speed-based duration, and optional repeat playback.
- Preserved generated-template rendering while allowing each instance to fill and resize within available timeline gaps.
- Differentiated video materials with cyan semantics and generated materials with violet semantics, with Generated selected by default in the material library.
- Added independently configurable corner-flash and mirrored beat-point performer signals, with subtle tile-inspired styling, preset and custom beat/accent colors, adjustable spacing, single/double-row layouts, multi-position placement, shared secondary accents, collapsible settings, and a lower-opacity white 5·6·7·8 visual lead.
- Unified the Performing sidebar spacing, title hierarchy, toggle styling, and Chinese localization across material settings and the material library.
- Added an Original Video underlay track, shared hidden-track ghost states, full-height timeline beat guides, stronger selected-material focus, blank-area deselection, current beat labels, silent-range free placement, and persistent native drag-session drop feedback.
- Added one-click conversion from a saved Learning video into a persisted Performing project while preserving its calibrated BPM, offset, onset, presentation start, and tracked beat data.

### Playback precision

- Kept paused previous/next beat navigation paused while seeking to the exact tracked beat.
- Added a paused-frame canvas so Chromium-based playback surfaces visibly commit the target frame without briefly starting playback.
- Corrected walking-layout card navigation so shared poses seek to the selected card's explicit beat endpoint.
- Shared the tracked beat grid and keyboard navigation behavior between the Learning Player and walking-layout editor.

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
- Added a section timeline with seeking, resizing, creation, loop cancellation, shared zoom/scroll navigation, and a continuously draggable playhead.
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

### Formation overlay

- Added a Formation entry between Mirror Practice and Display Hints in both wide and compact control layouts.
- Added a picture-in-picture formation panel over the video stage.
- Positioned the panel at the lower-right of the video by default, above the progress controls.
- Added free dragging constrained to the visible video area.
- Added Edit and Dismiss controls with consistent icon tooltips.
- Added an interpolated live formation preview that follows video playback.

### Formation editor

- Added a dedicated full-page formation-editing workflow with Back and Save actions.
- Added draft editing so Back discards changes while Save commits them to the local dance record.
- Added a video-and-stage layout with the formation timeline below and a Formation Changes sidebar on the right.
- Reused the main player control style for formation playback while omitting beat visualization and action-hint tools.
- Added manual formation changes composed of editable start and end times, formation previews, and normalized dancer positions.
- Added formation-preview seeking for start and end keyframes.
- Added a draggable SVG stage based on the Yihe dance-route manager geometry and numbered-marker palette.
- Moved the formation stage between the video and bottom timeline so the timeline and playback controls match the main player layout.
- Added dancer-count selection, explicit change/endpoint labels, context-aware start/end reset actions, and five-step undo/redo history.
- Replaced the endpoint label with direct Start/End switching and converted reset, synchronization, undo, and redo actions to player-style icon controls with tooltips.
- Added current-beat notation below the video in eight-count/beat format.
- Renamed all user-facing formation terminology to walking-path terminology.
- Enabled dancer-count changes and marker dragging on the default walking layout before any change is added.
- Fixed dancer-count changes so they update the default layout and every walking keyframe, including when no keyframe is selected.
- Changed the walking editor's previous and next controls to navigate one small beat at a time instead of jumping between walking keyframes.
- Replaced the walking editor's explicit Save action with automatic persistence for every layout, timing, dancer-count, and audience-orientation change.
- Added one-beat up/down steppers to walking-change start and end beat inputs.
- Fixed a live-sync gap where dragging the stage without a selected keyframe only changed an unsaved default layout; the editor now binds existing walking data to the nearest real keyframe.
- Restored interpolated walking animation during editor playback while keeping the selected keyframe fixed and editable when paused.
- Clicking a blank walking-timeline area now enters time-preview mode and holds the preceding change's end pose between changes.
- Made the orange walking-timeline playhead draggable for continuous video seeking without changing beat-snapped walking edits.
- Changed the overflow-menu Walking action to a checkbox item that reflects and toggles the overlay's open state.
- Restored stage editing while previewing timeline gaps by binding edits to the preceding end keyframe.
- Added marquee selection, Shift-click multi-selection, grouped dancer dragging, and Shift-constrained horizontal or vertical movement.
- Changed the default walking layout to a horizontally centered line and recentered it when dancer count changes.
- Replaced dense eight-count timeline ticks with clock-time labels.
- Added a shared timeline navigation component with coordinated zoom controls and a fill-width custom scrollbar between the timeline and player controls.
- Redesigned walking-change cards as continuous source-to-target transitions, with editable timing but a shared inherited source pose.
- Linked every transition start pose to the preceding target pose and made new transitions open directly on their editable target.
- Replaced vertical beat steppers with reliable left/right previous- and next-beat controls, removed invalid label nesting and hover fills, and kept at least one beat when forward stepping pushes a range boundary.
- Flattened walking cards into consistent vertical start/end rows, kept labels and unselected thumbnails visually uniform, used standalone transition arrows, and rendered shared-pose links gray until their shared pose is selected.
- Flushes the latest auto-saved player state before returning to the library so edits cannot be lost inside the persistence debounce window.
- Converted walking-change boundaries from seconds to editable eight-count/beat notation with beat-snapped timeline editing and one-beat default changes.
- Centered the editor beat counter and replaced the initial endpoint synchronization glyph with the standard sync icon.
- Reset start poses from the preceding walking change when available and invalidate end-pose synchronization whenever the start pose changes.
- Kept one-beat timeline ranges directly selectable while preserving compact edge-resize handles.
- Added a subtle stage grid with fluid dragging and grid-intersection snapping on drop.
- Corrected SVG pointer coordinate conversion so dancer markers remain aligned with the pointer in non-16:9 editor containers.
- Simplified the stage to a single neutral black-and-gray visual frame, removed the pink glow and purple guide tint, and added a configurable, persisted audience edge.
- Reworked the player walking overlay as a low-opacity blurred glass surface so the video remains visible while dancer markers stay fully opaque.
- Removed the dedicated overlay header and floated equal-size Edit and Dismiss controls over the content.
- Hid the overlay Edit and Dismiss controls until the panel is hovered or keyboard-focused.
- Replaced the empty walking state with a direct Edit Walking action.
- Enlarged the audience indicator consistently in the player overlay, editor, and keyframe previews.
- Initialized newly created formation changes from the previous change's end pose.
- Added formation interpolation between each change's start and end poses.
- Added a range timeline with seeking, selection, a live playhead, draggable time boundaries, and drag-to-create behavior.
- Preserved the playback position when entering or leaving the formation editor.

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
- Added consistent dark hover tooltips for every icon-only button, including keyboard-focus support and reliable dismissal on interaction, scrolling, focus loss, or target removal.
- Improved menu spacing, alignment, active states, checkbox states, focus rings, and viewport-safe positioning.
- Synchronized Play/Pause icons immediately with playback actions in both the main player and walking editor, while retaining native media-event reconciliation.
- Rendered left and right count-point visuals as independent Player sidebars so they no longer obscure the video.

### Export

- Added local video export without a backend.
- Added optional mirror, beat visualization, action hint, and count-in overlays.
- Reorganized export configuration around beat visuals, countdown, mirror, walking layout, and action markers with descriptions matching the current player features.
- Added animated walking-layout burning with top, bottom, left, right, and in-video overlay placements plus a lightweight wireframe preview.
- Combined the walking export toggle, placement controls, and wireframe into one continuous card with a single clipped outer radius and square internal seams.
- Initialized mirror, walking, and action-marker export selections from their current Player display states.
- Composited video overlays on an isolated video layer before placing them into an expanded output canvas, preserving correct coordinates for outside-video walking layouts.
- Composed video and walking as one region, then placed count-point visuals in a separate outer panel on the Player-configured top, bottom, left, or right side.
- Matched exported count-point style, orientation, and placement to the current Player configuration.
- Prevented long MP4 exports from freezing after walking animations or action markers by streaming encoder data in bounded chunks and explicitly submitting rendered canvas frames.
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
