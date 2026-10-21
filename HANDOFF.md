# Development handoff

Native HTML/CSS/ES5 home screen for LG 49SJ810V, webOS 3.5 (06.10.65), Chromium 38. No frameworks. Source: app/. Node.js runs local preview; LG CLI builds and installs IPK.

Commands: npm start; npm run check; npm test; npm run package.

## Current build: 0.6.6

TV folder playlists: scan-playlists.js reads only /var/lib/webosbrew/custom-home/playlists through the existing Homebrew exec bridge. Each M3U/M3U8 creates a stable filename-based tab; startup, channel-page opening and the TV-only refresh button trigger scans, never during IPTV. playlist-store.syncFolder preserves manual documents and valid cached content on read/parse/quota errors. Complete snapshots prune deleted files; removing an imported tab hides it until its file changes. Limits: 32 files, 1 MiB each, 2 MiB total; no symlinks. tools/tv-upload-playlist.js uses the configured LG CLI SSH session, validates SHA256 and performs an atomic upload with hidden backups. Never commit private playlist contents. The user's private file was uploaded separately; build 0.6.5 installed and launched. Folder/store regression tests and full checks passed.

Includes Montserrat Light/Bold, original application artwork, input icons, favorites-only home shelves, complete application/channel/input libraries, playlist tabs and persistent reordering. P+/P- stays within the playlist/favorites scope used to open a channel. Home launch always uses favorite channels.

TV application enumeration falls back from applicationManager/listApps to a fixed Homebrew Channel exec scanner. scan-apps.js reads developer/store/system app manifests and copies original artwork into Home's runtime-icons directory. It resolves system asset paths and omits hidden system components. TV scan was verified with 60 applications and 60 original icons.

## Settings and Aerial

The gear opens Settings / Screensavers. The catalog contains 139 Apple Aerial assets and 139 small packaged thumbnails. Red toggles favorites; desktop R emulates it. Click/OK opens a split preview with two catalog columns. Cross/Back closes it. Captions contain only translated name, original name and TimeOfDay | Scene. Full original metadata remains available in the data model.

Aerial selection is stored under home.aerial.favorites.v1. Empty favorites intentionally shows only the ambient clock. Idle is 120 seconds, rotation 5 minutes, preload starts 20 seconds before idle/rotation. Clicking the clock starts ambient mode. Cursor movements, cursor status pseudo-keys and transient visible-app blur do not dismiss it. Real key presses and Back dismiss it; hidden apps release playback.

Preview prioritizes 1080p AVC. Native preview video is outside transformed #screen. QuickTime ftyp brands caused browser MEDIA_ELEMENT_ERROR 4. aerial-stream.js serves catalog-only Apple streams on loopback port 9765 as compatible MP4 with byte-range support; only container brand bytes change. No transcoding, no video persistence, bounded backpressure, max four requests. Browser decoding was verified at 1920x1080 with advancing currentTime. On TV, Homebrew starts the Node/curl helper on demand; an idle helper exits after a minute. The normal preview server starts its own helper. Build 0.5.1 is installed and launched on the TV. The loopback helper starts on TV Node 0.12. Old TV CA roots rejected the Apple CDN certificate; the transport now scopes the current public Mozilla CA bundle plus the official Apple Root CA to curl, preserving TLS verification. Build 0.5.1 was installed on TV; a real Apple stream byte-range probe returned 20 bytes with the expected isom container brand. Browser playback was verified separately; TV visual playback still needs user confirmation.

## Autostart

Input-based Home autostart was verified by full TV reboot. app/boot.js activates only when /var/lib/webosbrew/custom-home/enabled exists. EIM's original store preserves Home as the boot input; normal input changes use a persistent bind-mounted copy. Home also invokes the existing Homebrew autostart service. See AUTOSTART.md for enable/disable and TV backup paths. LG Input Hook bindings are unchanged.

Early TV CoverUI displays Home / Loading independently of application splash settings. noSplashOnLaunch and spinnerOnLaunch do not suppress this early UI on this firmware. A reversible current-boot-only CoverUI mount was tested successfully on 21 October 2026; see the CoverUI trial section below. Firmware files remain unchanged.

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

## Aerial settings tabs (0.5.5)
Settings now has Favorites and All tabs, styled like channel playlist tabs. Favorites is the initial view; the selected tab remains while the app instance lives. Filtering reuses existing card/image nodes rather than rebuilding the catalog. Removing a favorite from Favorites closes its preview if open, updates the visible list, and moves focus to the nearest remaining card or selected tab. Left/right switches focused tabs; Down/OK enters cards; Up from the first row returns to the tab. Three-column preview navigation now correctly enters preview controls only from the third column. Browser checks verified add/remove via R (desktop red key), empty Favorites, full All catalog, and keyboard tab switching.

## CoverUI trial (21 October 2026)
User authorized hiding Home / Loading carefully. tools/tv-coverui.js patches exactly one visibility condition in StartUpUI.qml for com.custom.webos.home, with firmware-shape guards, SHA-256 verification, backup under /var/lib/webosbrew/custom-home/coverui and a temporary bind mount. Removal and reapplication were tested against real TV checksums. The mount survived remote power off/on, but surface-manager PID 1370 remained and cached QML still displayed the original text.
User separately authorized a compositor reload. tools/tv-coverui-reload.js armed an independent 180-second rollback watchdog before restarting surface-manager (new PID 18031). User then confirmed normal TV/remote operation and no Home / Loading text. Trial was confirmed and automatic rollback cancelled; current temporary mount is active. Original hash: 1996ed04293fc108823645262ca357db5dc96fbf9d2dc3fe8a4318b0d566310e. Patched hash: 25a96ed8b65e630f8fa91c53e1234ce921a4b65c72b70d62817b4dc76d456b90.
This is NOT persistent across full reboot/power loss. Homebrew hooks in the current input-based boot sequence run after Home has launched, too late for early CoverUI. No early boot/security changes, persistent hooks or firmware edits were made. Removing the mount restores the original file; a compositor restart/full reboot is needed to clear QML already in memory. Do not restart the whole UI again without separate user agreement. Both tools have local tests included in npm test.

## Folder transport fix (0.6.5)
Large scan reports exceeded the Homebrew exec output buffer. The scanner now returns bounded 8192-character JSON chunks; platform.js reassembles them and rejects changed snapshots using a SHA256 identity on every chunk. Private content is never logged. Added large Unicode transport and snapshot-change regression tests.

## Channel image queue (0.6.5)
channel-images.js loads only viewport-visible channel logos, at most four concurrent image requests, with 15-second slot deadlines and two delayed retries. Uses ES5 and bounding rectangles rather than IntersectionObserver. Scroll/focus/layout mutations schedule a throttled scan; hidden documents do not start loads. Library clones preserve lazy sources and drop in-flight src attributes. No persistent image cache or TLS proxy is added; invalid links and certificate failures may still leave initials. Regression tests cover queue bounds, visibility, loaded state, retry cooldown and hidden-page pause.

## Independent favorite logo fallback (0.6.5)
channel-images triggers TV.resolveChannelLogo only for visible favorites after original image retries fail or for missing URLs. One resolver at a time, session negative cache. Fixed Homebrew command accepts base64 ID/name, never stream URLs. resolve-channel-logo.js retrieves the public tv-logo/tv-logos tree, caches it for seven days, matches exact normalized filename/ID with country and Cyrillic transliteration using channel-logo-match.js; ambiguous matches are rejected. Downloads only PNG from the fixed GitHub repo using bundled CA, bounded to 512 KiB and 128 cached PNG files. Persistent cache lives outside app at /var/lib/webosbrew/custom-home/channel-logos; returned files are copied to own runtime-channel-logos directory for browser access. No iptv-org logo reuse. README credits collection and personal-use scope. Matcher and favorites-only loader regression tests pass.

0.6.5: Logo matcher prefers the country from tvg-id; if no matching logo exists there, accepts exactly one matching filename across other countries. Ambiguous local or global matches still return null. Kronehit.at@SD now resolves to countries/germany/kronehit-de.png. Regression tests cover country preference, foreign fallback and ambiguity.

0.6.5: Resolver persists an ID/name -> PNG index. --cached copies known cached PNGs to app runtime at startup with no network, and channel-images waits for this result before starting favorite image requests. Local cache takes priority over playlist URLs. Home long-press reordering now always exits on mouseup; channel Favorites library also allows reordering, syncing clone order to source shelf and home.order.channels. Grid geometry is invalidated after moves; vertical edge scroll supports the grid. Added local-first and actual drag/release/persistence regression tests. Existing older cached entries acquire their index on the next resolver use.

0.6.6: tv-logos lacks 1HD Music Television. Bundled original SVG from https://www.1hd.ru/img/logo.svg with explicit HD/SD ID mapping; static vector paths, no external images or scripts.
