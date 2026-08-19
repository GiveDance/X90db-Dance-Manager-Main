# Dance Manager Feature Iteration History

This document records the product evolution of Dance Manager from its creation as a standalone application based on DancePlayer. Entries are ordered chronologically to show how the product, interaction model, and technical foundations developed over time.

## 2026-08-11 - Dance Manager foundation

### Iteration 1: Standalone product and local Learning workflow

Dance Manager was established as a local-first dance learning application.

- Rebranded the copied DancePlayer application as Dance Manager across package metadata, documentation, and the web manifest.
- Replaced the original documentation with the Dance Manager product overview, workflow, privacy model, and development instructions.
- Added a persistent local dance library backed by IndexedDB, with video bytes stored separately from project metadata.
- Added saved-video covers, duration, BPM, update time, hint count, export, and deletion actions.
- Decoupled playback from background video persistence so large local saves do not block entry into the player.
- Added IndexedDB recovery, transaction timeouts, bounded retries, stale-transaction cleanup, and serialized metadata writes.
- Replaced Blob/File persistence with ArrayBuffer-backed records for embedded WebKit compatibility while retaining legacy record support.

### Iteration 2: Rhythm analysis and Learning tools

The Learning Player became a beat-aware practice environment rather than a basic video player.

- Added automatic music-onset, BPM, and beat-offset analysis during upload.
- Added full-track Web Audio decoding, browser-media PCM capture, third-party beat detection, and a local energy-envelope fallback.
- Corrected sampled-audio timing against actual media duration and retained 120 BPM only as the final fallback.
- Added canonical rhythm metadata, immutable first-analysis values, and automatic migration for older saved records.
- Added dot, tile, edge-pulse, and breath-light rhythm visualizations with configurable placement and synchronized export rendering.
- Added derived eight-count navigation, List and Tile views, previous/next navigation, looping, and visual `5-6-7-8` preparation counts.
- Added automatic and manual dance sections with contiguous selection, naming, resizing, playback, looping, and timeline navigation.
- Added Action Hints with editable timing, text, descriptions, colors, persistence, section association, and exported-video rendering.
- Added BPM, first-beat, tap-tempo, current-frame, and reset controls for rhythm calibration.
- Reworked player controls for compact layouts, hover media controls, keyboard access, tooltips, playback speed, and volume.

## 2026-08-12 - Formation and Performing foundations

### Iteration 3: Formation planning and Learning export

Dance Manager expanded from learning a dance to planning spatial movement.

- Added a full-page formation editor with video, stage, timeline, inspector, playback controls, and automatic persistence.
- Added editable walking changes with start/end poses, dancer-count management, audience orientation, interpolation, and beat-snapped timing.
- Added draggable dancer markers, marquee and multi-selection, grouped movement, axis constraints, grid snapping, undo/redo, and audience-edge configuration.
- Added linked transition poses so each walking change inherits the previous target pose.
- Added timeline seeking, drag-to-create, range resizing, continuous playhead dragging, gap preview, and clock/beat notation.
- Added an interpolated picture-in-picture formation overlay to the Learning Player.
- Added local Learning video export with mirror, rhythm visualization, count-in, action hints, and animated walking-layout overlays.
- Added export placement controls, progress, cancellation, completion states, bounded encoder streaming, and long-export reliability fixes.

### Iteration 4: Performing project architecture and rhythm-kernel upgrade

The product gained a separate Performing workflow without replacing the established Learning workflow.

- Added Learning and Performing as distinct project modes with separate Performing project persistence.
- Added a Performing workspace with stage preview, media library, composition timeline, inspectors, transport controls, and project save flow.
- Added generated stage templates and reusable composition materials.
- Reused calibrated Learning rhythm data when creating a Performing project.
- Upgraded rhythm analysis to the madmom -> Essentia -> legacy fallback chain while preserving tracked beats, eight-counts, onset, calibration, and section behavior.
- Persisted analysis-engine metadata so downstream Performing features consume rhythm results without reimplementing beat detection.

## 2026-08-13 - Performing composition system

### Iteration 5: Performing information architecture

- Restructured the Performing sidebar into material settings and material library regions aligned with the Learning Player hierarchy.
- Split the timeline into a full-duration Overlay track and a Composition track.
- Moved performer-signal settings into the selectable Overlay timeline material.
- Presented uploaded clips and generated templates as reusable library materials.
- Added shared zoom and horizontal-scroll controls and reused Learning transport behavior for beat navigation, playback speed, volume, and keyboard shortcuts.
- Matched preview dimensions to the uploaded source aspect ratio and promoted the workspace header above the full editor.

### Iteration 6: Reusable timeline materials

- Converted uploaded videos and generated templates into draggable, non-overlapping Composition materials.
- Added reusable media assets with thumbnails and independent timeline instances.
- Added source-aware trimming, playback-rate duration mapping, optional repeat playback, Delete-key removal, and gap-aware placement.
- Allowed generated templates to fill and resize within available timeline gaps without changing their rendering behavior.
- Differentiated video and generated materials with consistent cyan and violet semantics.

### Iteration 7: Configurable performer signals

- Added independently configurable corner-flash and mirrored beat-point signals.
- Added preset and custom beat/accent colors, adjustable spacing, single/double rows, multiple placements, and secondary accents.
- Added a lower-opacity white `5-6-7-8` visual lead.
- Unified signal settings, collapsible controls, tile-inspired styling, and Chinese localization.

### Iteration 8: Shared composition and Learning timeline language

- Added an Original Video underlay track and shared hidden-track ghost states.
- Added full-height beat guides, stronger selected-material focus, blank-area deselection, current-beat labels, and silent-range free placement.
- Added persistent native drag-session feedback.
- Refined Learning section, formation, and Performing composition timelines around a shared navigation and visual system.

## 2026-08-14 - Unified landing and project entry

### Iteration 9: Learning and Performing landing experience ([#1](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/1))

- Added the redesigned Learning/Performing landing experience and mode-specific upload entry.
- Added a shared project library with Learning and Performing type states.
- Added bidirectional project generation that reuses stored media and rhythm data.
- Reused saved Learning beats in Performing projects without changing beat detection, count-in, or snapping behavior.
- Landed the generated performance clip, Overlay track, and Composition timeline work as one coherent workflow.

### Iteration 10: Homepage visual narrative ([#2](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/2))

- Replaced the interactive gradient and tuning controls with a full-screen muted monochrome landing video.
- Removed the Pixi dependency and obsolete project-library implementations.
- Synchronized two eight-character slogans and per-character beat ticks to the corrected 148 BPM landing video.
- Refined landing header layout, typography, video contrast, brightness, and slogan legibility.
- Prevented saved-project rhythm analysis from leaking audio during loading.

## 2026-08-17 - Motion analysis and stage visualization

### Iteration 11: Motion Analyzer integration ([#3](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/3))

- Integrated the complete Motion Analyzer into Dance Manager as an in-app motion-calibration workflow.
- Added dual-video pose comparison, audio/motion synchronization, timeline review, and coaching feedback.
- Added cancellable MediaPipe video analysis and explicit resource cleanup.
- Added direct return navigation to Dance Manager.
- Linked the portable beat-vibration companion from the early-access area.
- Unified landing CTAs and workspace mode tabs into one responsive scrolling mode selector.

### Iteration 12: Generated-stage visual refresh ([#4](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/4))

- Redesigned performer beat-point palettes and improved stage-signal readability.
- Rebuilt the Street template as the Prismatic Spectrum procedural visual.
- Added real-effect thumbnails, updated generated-template naming, and removed the redundant stage-asset information tag.

### Iteration 13: Performing rhythm contract ([#5](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/5))

- Refined Performing stage templates, rhythm signals, countdowns, and timeline presentation.
- Persisted analysis-engine metadata and kept Performing as a read-only consumer of parsed rhythm data.
- Established the approved madmom -> Essentia -> legacy parser baseline as a protected product contract.
- Added updated stage-template thumbnails.

## 2026-08-18 - Export and interaction refinement

### Iteration 14: Performing video export ([#6](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/6))

- Added browser-local Performing export with automatic MP4/WebM capability detection.
- Exported source media, composition clips, generated templates, overlays, mirrored playback, performer signals, and project audio.
- Shared clip source-time mapping and frame rendering between preview and export.
- Added export progress, cancellation, deterministic timing, and reliable media-resource cleanup.

### Iteration 15: Homepage and cross-workspace navigation ([#7](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/7))

- Refined responsive homepage snap navigation, spacing, typography hierarchy, project-card styling, and mode entry.
- Added the Learning Player follow-along review entry.
- Added source-aware Motion Analyzer return navigation.
- Returned Learning and Performing players to the homepage workspace and aligned their export presentation.

### Iteration 16: Formation and Performing interface alignment ([#8](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/8))

- Refined the formation stage into a square 64-by-36 grid with matching snap behavior.
- Aligned formation timeline cards, beat labels, inspector timing, and walking navigation to tracked beat timestamps.
- Standardized project, formation, and Performing card states.
- Aligned the Motion Analyzer header with the Performing shell.
- Added Performing video upload by click and drag and drop.

### Iteration 17: Shared timeline interactions ([#9](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/9))

- Matched section and formation drag/resize behavior to Performing composition clips.
- Unified timeline card typography, spacing, fills, resize handles, playheads, and navigation controls.
- Adapted beat-guide density to zoom while preserving downbeat emphasis.
- Tightened Performing row hierarchy and removed duplicate section highlights.

### Iteration 18: Player and panel visual system ([#10](https://github.com/GiveDance/X90db-Dance-Manager-Main/pull/10))

- Unified Learning, Performing, and formation-editor transport controls and panel surfaces.
- Refined sidebar actions, section titles, card insets, functional spacing, and cross-panel alignment.
- Simplified redundant panel dividers and timeline handle decoration.
- Improved formation-grid readability and simplified the audience marker.
- Refined homepage mode tabs and project-card hover playback affordances.
- Disabled Action Hints by default while preserving the existing toggle and export behavior.

## Product state after these iterations

Dance Manager now provides three connected local-first workflows:

- **Learning:** rhythm analysis, calibration, eight-count and section practice, loops, action hints, formation preview, and local export.
- **Performing:** reusable media composition, generated stages, performer signals, rhythm-synchronized preview, and browser-local export.
- **Motion Analysis:** dual-video movement comparison and coaching feedback connected to the same project entry and navigation system.

The shared rhythm contract remains the approved madmom -> Essentia -> legacy parser chain. Performing, formation, timeline, signal, and export features consume its persisted beat data rather than implementing separate rhythm detection.
