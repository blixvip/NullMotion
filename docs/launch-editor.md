# Launch editor

The editor adapts MotionClone's reference selection, in/out ranges, ordered segments, and branding workflow into Null's dark interface. Source reference: MotionClone `web/editor.html`, `web/editor.js`, and `web/editor.css`. Account connection and generation calls were not imported.

The promotion layout is arranged vertically:

1. Full-frame film preview, optional identity overlay, safe-area guides, and film/original toggle.
2. Clip timeline with source thumbnails, brand track, playhead, trimming, and undo/redo.
3. Reference-video tabs and short selectable moments with hover playback and insertion controls.

The first visit assembles a four-clip example from Infinite, Hero, Talis, and Supahub. Changes save in this browser. The Play concept control plays the selected source intervals in order, with a light brand overlay. Present removes workspace controls for recording the concept. Escape restores the editor. The video uses contain sizing so artwork is not cropped or distorted.

The reference importer creates time ranges rather than rendering separate files. This keeps original quality, storage use, and editability. Preview posters are extracted at each segment's midpoint. Byte-range streaming supports scrubbing large sources. The curation policy removes the live-action Astra promo and its 40 segments, including on reimport. The original MotionClone source is preserved.

## Verified locally

- 20 motion-graphics reference videos and 142 segments available after curation.
- Playback crosses from one source video to the next.
- In/out validation, insert, reorder, remove, undo/redo, and saved restoration.
- Brand name, message, palette, portrait/landscape/square modes, and presentation mode.
- Reference dialog, search empty state, empty timeline and reinsertion, local video upload.
- Desktop, tablet, and mobile layout; screenshots inspected.

No AI generation, encoded final-video export, account system, or public media hosting is included in this pass.
