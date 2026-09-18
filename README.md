# Null

A launch-film preview: a finished motion-graphics ad plays on top, and underneath it the super-simple black-and-white HyperFrames drafts it grew from — one per section, each an HTML scene driven by a GSAP timeline. A playhead runs across the drafts; the draft for the section on screen follows the film exactly and is outlined in orange. **Download → Whole preview** renders the film and its drafts frame by frame into a high-bitrate MP4 with the film's audio (Chrome or Edge).

The earlier launch editor (reference timeline, trimming, brand controls) is at `/editor`, and the original Null Motion gallery at `/index.html`.

## Showcase

The repository ships three references in `showcase/`: **Infinite · Global payments**, **SaaS · Launch sequence** and **Motion study 08**, with their drafts. They are reference clips from other creators, shown as examples; they are not claims of commissioned work. A fresh checkout plays these three. A locally imported library (below) takes precedence and is never committed.

## Run locally

Install Node.js 22 or newer, then:

```sh
npm start
```

Open <http://127.0.0.1:4343>. There are no runtime packages to install and no credentials to configure.

## Bring in MotionClone references

With Python, FFmpeg, and ffprobe installed:

```sh
python scripts/import-motionclone.py --source /path/to/MotionClone
```

The importer includes saved source videos and the standalone Nexa/Troovy reference folders. It creates non-destructive segments of roughly four seconds, extracts a thumbnail for each segment, and links the videos into `.local-media/`. The source and this project must be on the same filesystem for hard links. Original files are read only; no encoding or source cutting occurs. Full source videos remain playable and segment in/out points are editable.

Media, reference titles, and extracted thumbnails stay local and are excluded from Git. The server supports byte ranges so seeking does not read entire videos into memory. A fresh checkout shows only the showcase until references are imported. Browser uploads last for the current session.

The curated local library contains 20 motion-graphics references and 142 segments. The live-action Astra promo is excluded by `data/reference-policy.json`; reimporting does not restore it. These are reference clips, not claims of commissioned work. Public hosting needs separately supplied media you can distribute.

`npm run showcase` rebuilds `showcase/` from the local library (re-encoded 1080p video, audio, posters, sections and drafts for the three showcase references). `scripts/plan-sections.mjs` splits references into sections at scene changes; the drafts themselves are authored in `public/references/drafts.json`.

The preview displays source footage full-frame at its original proportions, with optional brand overlays, safe-area guides, and presentation mode. Brand layers do not rewrite text already in the footage. Saved custom sequences are retained; excluded references are removed from saved timelines when loaded.

The optional `PORT` environment variable changes the port. `HOST` defaults to `127.0.0.1`; set it to your hosting environment's required bind address when deploying. This repository does not provision a hosted service.

## Develop

```sh
npm run dev
npm run check
npm test
```

- `public/editor.*` and `public/editor-model.mjs`: launch editor, interactions, and timeline operations.
- `public/`: the inherited gallery, styles, template previews, and artwork.
- `data/template-catalog.json`: the bundled template definitions.
- `server.js` and `media.js`: static UI data and streaming reference playback.
- `test/`: timeline boundaries, clip order, video ranges, previews, and file isolation.

The browser calls this project's own origin. It does not connect to the original Null Motion companion. Build new authenticated backend routes before enabling generation or shared data storage.

## Project boundary

This project starts with fresh Git history. It contains no personal render history, database, provider configuration, local credentials, or Premiere extension. Drafts and UI preferences use this project's browser origin.

Only selected source media and its reference catalog are imported locally; MotionClone job records, generated outputs, and account settings are not copied. Brand changes apply to the concept composition. Text and marks baked into source footage remain unchanged.

The original UI is retained to provide a starting point; inherited provider names, timing labels, and pipeline diagrams describe the future integration surface, not implemented service guarantees. External AI tools require their own accounts and may need to open in a separate tab.

## Third-party notices

The bundled GSAP file retains its copyright and license header; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand artwork belongs to its respective owners. No project-wide open-source license has been selected.
