# Development handoff

Native HTML/CSS/ES5 home screen for LG 49SJ810V, webOS 3.5 (06.10.65), Chromium 38. No frameworks. Source: app/. Node.js runs the preview; LG CLI builds and installs IPK.

Commands: npm start; npm run check; npm test; npm run package.

Last installed version: 0.2.3. Includes original app icons, standard YouTube logo for AdFree, PS scale(1.8), two HDMI sources, conditional USB, year in date, bundled Noto Sans, persistent long-press reordering, HD IPTV shelf and fullscreen player. Autostart is not configured.

## Accepted changes still pending

- Use bundled static Montserrat Light for regular text, Bold for currently bold text. Font downloads were started: check files and license before use.
- PS scale(2) instead of scale(1.8).
- Show a partial next/previous tile at shelf edges for apps and channels, as scrolling affordances.
- Add All apps / All channels links above the shelves, opening fullscreen grids. Support remote, pointer, Back, and focus restoration.

## Constraints

Preserve localStorage ordering keyed by app key and channel URL. Playlist: app/channels.m3u plus iptv-org/languages/bel.m3u updates. Filter >=720p. Keep offline resources. CORS failure is unknown, not proof that a channel is down.

P+/P- handlers support ChannelUp/Down, PageUp/Down, 33/34 and 427/428. Tested in the browser; physical TV buttons are unconfirmed. LG Input Hook is installed on the TV but its bindings have not been changed.

Configure TV access and authentication separately on another computer. Never commit passwords or SSH keys. See README.md for implementation details and limitations.
