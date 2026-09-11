# Performance & Maintainability Analysis

Date: 2026-09-11
Scope reviewed: `app.py`, `static/script.js`, `static/style.css`, `templates/index.html`

## Performance — biggest lever first

1. **O(n) history replay on every request** (`app.py` `current_source_image()`, ~line 378-384).
   Every `/process`, `/revert`, and `/history/*` call reprocesses the *entire* edit
   chain from the original image. With a 150ms debounce firing on slider drags, and
   e.g. 15 committed history steps, each preview request re-runs 15 full PIL/OpenCV
   pipelines instead of 1. This cost is not fixed — it grows with how long a user
   keeps editing, making it the dominant bottleneck.
   - Fix: cache the rendered image keyed by `(image_id, active_history_count)`,
     replaying only the steps added since the last cache hit. Invalidate the cache
     on any structural change (reorder/delete/import). Contained change, no new
     dependencies.

2. **Single-threaded dev server** (`app.py` ~line 653, `app.run(debug=True)` without
   `threaded=True`). Requests are serialized, including slow Real-ESRGAN calls — a
   stuck upscale blocks the preview endpoint for the whole app.
   - Fix: add `threaded=True` at minimum; for real use, run under `waitress` or
     `gunicorn` with a small worker pool. Low effort, high payoff.

3. **Real-ESRGAN cold start**: lazily loaded on first request under a lock (fine),
   but only pre-warmed in `__main__` when not in the debug reloader's child watcher.
   Works today because `debug=True` is hardcoded, but fragile if that ever changes
   without revisiting the pre-warm branch.

Everything else (LUT-based tone/vibrance curves, `cv2.INTER_AREA` downscaling,
server-side preview downscaling before encode) is already done sensibly — no need
to touch it.

## Maintainability

1. **`app.py` mixes five concerns in one file**: path/filesystem helpers, pure
   image-processing functions, ML model bootstrapping, and Flask routes, with
   `HISTORY` / `ACTIVE_HISTORY_COUNT` as bare module-level globals acting as an
   ad-hoc single-user database. Splitting into `imaging.py` (pure functions),
   `history.py` (state + step logic), `realesrgan.py` (model loading), and
   `app.py` (routes only) would make this testable independently of Flask.

2. **`static/script.js` is a single 990-line file** with ~40 top-level `const` DOM
   lookups and all state in one global `state` object — no modules. Readable today,
   but every new feature (another slider, another history action) adds to one flat
   file. Splitting into small ES modules (`history.js`, `crop.js`, `zoom.js`,
   `sliders.js`) behind `<script type="module">` needs no build step and would cut
   coupling meaningfully.

3. **No tests anywhere.** The pure image-processing functions (`apply_vignette`,
   `apply_tone_region`, `apply_channel_balance`, etc.) are very testable — numpy
   array assertions on known inputs — and cheap to add.

4. **Minor bug**: `app.py` `remove_history_steps()` (~line 82-83) sets
   `ACTIVE_HISTORY_COUNT[image_id] = 0` twice — leftover duplicate line, harmless
   but worth cleaning up.

5. **Global state is single-user by design** — `clear_working_images()` wipes
   everyone's in-progress image on any new upload. Fine for a local single-user
   tool, but caps how far this can go toward multi-user without a real
   per-session/store redesign.

## Recommendation

Highest-value, lowest-risk first pass:
- (a) add the history-replay cache
- (b) turn on threaded serving
- (c) fix the duplicate-line bug

This removes the main growing cost (replay) without any big-bang rewrite. File
splitting and test coverage are valuable for long-term maintainability but are a
separate, non-urgent refactor best done incrementally.
