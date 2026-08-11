# DanceManager Product Overview

## Purpose

DanceManager helps dancers learn and organize choreography through visual rhythm guidance, eight-count navigation, repeatable practice loops, and reusable dance sections.

## Product principles

1. **Video first**: controls and guidance must not obscure choreography.
2. **Rhythm aware**: navigation, loops, countdowns, and visual feedback follow the analyzed beat grid.
3. **Accessible**: important rhythm information is available visually without relying on audio.
4. **Offline first**: source media and user data remain in the local browser.
5. **Fast practice loops**: frequent actions should be reachable with minimal interaction.
6. **Recoverable analysis**: automatic BPM and offset detection can be manually calibrated.

## Core workflow

1. Upload a local dance video or open one from the local library.
2. Analyze music onset, BPM, and beat offset.
3. Navigate by eight-count using List or Tile view.
4. Loop an eight-count or section with a `5-6-7-8` preparation count-in.
5. Select contiguous eight-counts to create a named section.
6. Add markers, adjust playback, or enable visual beat guidance.
7. Export a locally rendered practice video when needed.

## Rhythm visualization

- **Dots**: eight labeled points with active-beat emphasis.
- **Tiles**: four large count tiles that alternate between `1-4` and `5-8`.
- **Pulse**: beat-synchronized edge illumination.
- **Breath**: beat-synchronized glow and scale animation.

Before detected music entry, all modes retain their normal timing and animation while using a neutral grayscale palette. After entry, downbeats use pink/purple and regular beats use blue.

## Local data

IndexedDB stores video bytes and dance metadata separately. Metadata includes analyzed and calibrated tempo values, music onset, duration, sections, and markers. New video records use ArrayBuffer-backed storage for compatibility across embedded browser engines.
