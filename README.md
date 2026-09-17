# Null

A launch-film concept editor built on Null Motion's visual foundation and MotionClone's reference-segment workflow. A large branded preview sits above a clip timeline and a library of reference moments.

This is a **promotion demo**, with working reference playback, in/out trimming, clip insertion, drag reordering, undo/redo, search, browser-local saving, and live brand controls. The film preview combines source clips with a browser-rendered brand composition. It is not an AI-reconstructed or exported video; generation and rendering are not connected.

The original Null Motion gallery remains at `/index.html`.

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

Media, reference titles, and extracted thumbnails stay local and are excluded from Git. The server supports byte ranges so seeking does not read entire videos into memory. A fresh checkout opens with an empty library until references are imported or uploaded. Browser uploads last for the current session.

The current local library contains 21 references and 182 segments. These are reference clips, not claims of commissioned work. Public hosting needs separately supplied media you can distribute.

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
