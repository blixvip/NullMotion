# Launch editor

The editor adapts MotionClone's reference selection, in/out ranges, ordered segments, and branding workflow into Null's dark interface. Source reference: MotionClone `web/editor.html`, `web/editor.js`, and `web/editor.css`. Account connection and generation calls were not imported.

The promotion layout is arranged vertically:

1. Large film preview, live identity controls, and concept/reference toggle.
2. Clip timeline with source thumbnails, brand track, playhead, trimming, and undo/redo.
3. Reference-video tabs and short selectable moments with hover playback and insertion controls.

The first visit assembles a four-clip example from different references. Changes save in this browser. The Play concept control plays the selected source intervals in order while the brand composition updates. Present removes workspace controls for recording the concept. Escape restores the editor.

The reference importer creates time ranges rather than rendering 182 separate files. This keeps original quality, storage use, and editability. Preview posters are extracted at each segment's midpoint. Byte-range streaming supports scrubbing large sources.

## Verified locally

- 21 reference videos and 182 segments imported.
- Playback crosses from one source video to the next.
- In/out validation, insert, reorder, remove, undo/redo, and saved restoration.
- Brand name, message, palette, portrait/landscape/square modes, and presentation mode.
- Reference dialog, search empty state, empty timeline and reinsertion, local video upload.
- Desktop, tablet, and mobile layout; screenshots inspected.

No AI generation, encoded final-video export, account system, or public media hosting is included in this pass.
