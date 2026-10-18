# YT Full Viewport

A small Chromium/Brave extension that makes the YouTube player fill the whole
browser window (no fullscreen), with a TV-style shelf of recommended videos.

## Features

- Player fills the full viewport on `/watch` pages; title, comments and related
  videos are hidden.
- Move the cursor to the far left or right edge to hide the player overlay and cursor.
- Scroll down over the video to open a row of recommended videos (like YouTube on TV).
  Scroll or use the Left/Right arrows to move along the row, click to play,
  scroll up or press Esc to close.
- Press **W** (or use the button next to the fullscreen button) to toggle the mode.
  The setting is remembered.

## Install (Brave / Chrome / Edge)

1. Clone or download this repo.
2. Open `brave://extensions` (or `chrome://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).

## Developing

After editing `content.js` or `content.css`, click the reload icon on the extension
card in `brave://extensions`, then hard refresh YouTube (Ctrl+Shift+R).

Tweaks live at the top of `content.js` (for example `EDGE_PX`, the width of the
hover zone that hides the overlay).

## Publishing changes

```bash
./push.sh "what changed"     # stage everything, commit, push
```

Bump `"version"` in `manifest.json` when you make a notable change; `push.sh` uses
it in the default commit message.

## Notes

YouTube changes its page structure often. If something stops working, the CSS
selectors in `content.css` and the recommendation scraping in `content.js`
are the places to check.
