# DanceManager

DanceManager is a browser-based workspace for learning, organizing, and practicing dance videos. It combines local rhythm analysis, eight-count navigation, section management, looping, visual beat guidance, and local video persistence in one offline-first application.

All video and audio processing runs locally in the browser. Source media is never uploaded.

## Features

- Automatic music-onset, BPM, and beat-offset analysis.
- List and tile views for navigating eight-counts.
- `5-6-7-8` preparation count-in before beat playback and loops.
- Contiguous multi-selection for creating custom dance sections.
- Section timeline editing and looping.
- Dot, tile, pulse, and breath beat visualizations.
- Neutral grayscale visualization before music entry.
- Responsive playback controls with previous/next eight-count navigation.
- Playback speed, volume, mirror, markers, and danmaku tools.
- IndexedDB-backed local dance library with persistent videos and metadata.
- Local video export with optional overlays.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run lint
npm run build
```

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Web Audio API
- IndexedDB
- `web-audio-beat-detector`

## Privacy

DanceManager has no application backend, account system, or cloud media storage. Videos, analysis results, sections, markers, and calibration data remain on the user's device. Clearing browser site data removes the local dance library.
