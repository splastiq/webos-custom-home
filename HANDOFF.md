# Development handoff

Native HTML/CSS/ES5 home screen for LG 49SJ810V, webOS 3.5 (06.10.65), Chromium 38. No frameworks. Source: app/. Node.js runs local preview; LG CLI builds and installs IPK.

Commands: npm start; npm run check; npm test; npm run package.

## Current build: 0.5.4

Includes Montserrat Light/Bold, original application artwork, input icons, favorites-only home shelves, complete application/channel/input libraries, playlist tabs and persistent reordering. P+/P- stays within the playlist/favorites scope used to open a channel. Home launch always uses favorite channels.

TV application enumeration falls back from applicationManager/listApps to a fixed Homebrew Channel exec scanner. scan-apps.js reads developer/store/system app manifests and copies original artwork into Home's runtime-icons directory. It resolves system asset paths and omits hidden system components. TV scan was verified with 60 applications and 60 original icons.

## Settings and Aerial

The gear opens Settings / Screensavers. The catalog contains 139 Apple Aerial assets and 139 small packaged thumbnails. Red toggles favorites; desktop R emulates it. Click/OK opens a split preview with two catalog columns. Cross/Back closes it. Captions contain only translated name, original name and TimeOfDay | Scene. Full original metadata remains available in the data model.

Aerial selection is stored under home.aerial.favorites.v1. Empty favorites intentionally shows only the ambient clock. Idle is 120 seconds, rotation 5 minutes, preload starts 20 seconds before idle/rotation. Clicking the clock starts ambient mode. Cursor movements, cursor status pseudo-keys and transient visible-app blur do not dismiss it. Real key presses and Back dismiss it; hidden apps release playback.

Preview prioritizes 1080p AVC. Native preview video is outside transformed #screen. QuickTime ftyp brands caused browser MEDIA_ELEMENT_ERROR 4. aerial-stream.js serves catalog-only Apple streams on loopback port 9765 as compatible MP4 with byte-range support; only container brand bytes change. No transcoding, no video persistence, bounded backpressure, max four requests. Browser decoding was verified at 1920x1080 with advancing currentTime. On TV, Homebrew starts the Node/curl helper on demand; an idle helper exits after a minute. The normal preview server starts its own helper. Build 0.5.1 is installed and launched on the TV. The loopback helper starts on TV Node 0.12. Old TV CA roots rejected the Apple CDN certificate; the transport now scopes the current public Mozilla CA bundle plus the official Apple Root CA to curl, preserving TLS verification. Build 0.5.1 was installed on TV; a real Apple stream byte-range probe returned 20 bytes with the expected isom container brand. Browser playback was verified separately; TV visual playback still needs user confirmation.

## Autostart

Input-based Home autostart was verified by full TV reboot. app/boot.js activates only when /var/lib/webosbrew/custom-home/enabled exists. EIM's original store preserves Home as the boot input; normal input changes use a persistent bind-mounted copy. Home also invokes the existing Homebrew autostart service. See AUTOSTART.md for enable/disable and TV backup paths. LG Input Hook bindings are unchanged.

Early TV CoverUI displays Home / Loading independently of application splash settings. noSplashOnLaunch and spinnerOnLaunch do not suppress this early UI on this firmware. No CoverUI or firmware files were modified.

## Persistence and constraints

Preserve existing localStorage keys and ordering by stable app key / channel URL. Custom M3U documents, optional source URLs and snapshots live in home.playlists.v1. Original Belarus playlist has its own tab after Favorites. All channels includes SD; only initial HD channels seed home favorites. Removing a playlist never revives it during background updates. CORS failures mean unknown health, not a broken channel.

Settings are still localStorage; uninstall/data clearing may remove them. No external-file settings service is implemented. USB hotplug and physical remote edge cases still need device checks as changes are made. TV and desktop storage are separate.

Configure TV access/authentication separately on another computer. Never commit passwords, keys or personal TV settings. LG CLI device alias on this computer is tv. Application ID: com.custom.webos.home.

See README.md and ARCHITECTURE.md for modules, checks, limitations and use.

## Aerial playback follow-up (0.5.2)
TV preview was visually confirmed by the user after using an explicit MP4 source/load and removing visibility/clipping constraints. Native diagnostics showed AVC stuck at currentTime 0 while HEVC 1080p advanced 4.659 → 9.676 → 14.692 seconds. Preview now prefers HEVC 1080p on TV, AVC on desktop. Poster remains until actual time advances. Optional loopback diagnostics are enabled only with HOME_AERIAL_DEBUG=1; normal mode sends no state samples.
Ambient playback no longer resets retry budgets on playing events. Failed variants are skipped for the rest of the session, exhausted assets are excluded, and 15 seconds without timeline progress triggers fallback. Rotation and watchdog timers are reset per source. TV queues the next asset but does not start a concurrent preload decoder; desktop keeps video preloading. This replaces the older simultaneous-preload description above for TV.

Preview layout uses three 300px card columns (972px grid) and a 700×394 preview on the right. Remote vertical navigation uses three columns. A small CSS loading indicator overlays the poster until playback advances; failure/close clears it.

## Preview buffering follow-up (0.5.3)
The user reported another timeout on Dubai after 0.5.2; the prior single successful preview did not establish reliability across assets. TV curl probes of Dubai HEVC returned HTTP 206 but took 19.48 s for 1 MiB in one run and 4.869 s in another (first byte 0.497 s). Preview now renews its 30-second inactivity deadline only when the buffered end advances, with a separate absolute 120-second cap. It no longer labels every exhausted retry as an unsupported format. The TV source explicitly requests the documented URI/video_only mediaOption for these silent clips. Tests include progress renewal and the absolute deadline; the user confirmed Dubai video starts on TV with this build.

## Playback recovery and ambient arrows (0.5.4)
Los Angeles temporarily froze and then resumed on its own, consistent with rebuffering. Preview now watches actual timeline changes after startup, shows buffering after 3 seconds without progress, and tolerates short waits. After 45 seconds without playback and 30 seconds without buffer growth (absolute 120-second freeze cap), it reconnects the same format once and restores the timestamp; repeated failure advances format, never an infinite restart loop. Duplicate timeupdate events do not clear buffering. Closing cancels watchdogs and pending recovery. Unit tests use a fake clock to verify this behavior.
Left/right while ambient mode is active cycle all selected favorites in catalog order and wrap in both directions, without dismissing the saver. Held keys are suppressed until keyup. Manual selection may retry previously failed variants, preserving bounded automatic retries. Back and other wake keys retain their normal behavior. Tests cover three favorites with an excluded fourth asset, wraparound, held keys, empty selection, and Back.
