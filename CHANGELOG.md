# Changelog

## v1.8.0
- **Map tab: your artists laid out by sound.** Every artist with genre tags sits near the artists whose tags match theirs, grouped into named neighbourhoods (k-means over the tags, weighted so a rare tag counts for more than "rock"). Similar artists Last.fm already gave Vibo pull pairs closer; the build only reads what is cached and fetches nothing. Click an artist for its tags and neighbourhood and to open its page; right-click for the usual artist menu. Built on demand (**Build map**) and kept until you rebuild.
- Size dots by plays or by tracks, show every Last.fm link at once, and jump between an artist's closest neighbours from its card. "Reading the map" notes say what the map can't tell you (untagged artists, generic tags, unreadable tags).
- Settings → Map: an off-by-default option to keep artists whose names are written in Greek together, and a Build / Rebuild button.
- The Map tab needs Viboplr 1.0.125 (its `scatter-map` view); older versions don't show it, and everything else works as before. No `minAppVersion` bump.

## v1.7.2
- Each permission now says why the plugin needs it, shown under it when Viboplr asks. No functional changes.

## v1.7.1
- Releases are now signed with the Viboplr plugin-signing key, so Viboplr allows the permissions this plugin asks for without prompting. No functional changes.

## v1.7.0
- **Runs in the plugin worker runtime.** It now gets only what it asks for
  — `library:read`, `playback:control` — and can't reach anything else in the app. Viboplr asks
  you to allow these once when you update. Requires Viboplr 1.0.85.

## v1.6.0
- Adopt the host-drawn view header (Viboplr 1.0.77+). The header's subtitle now sums the library up ("12,340 tracks · 48,211 plays since Mar 2024 · Updated Sep 29, 2026"), a status word shows "Computing… 42%" during a build or "Failed" after an error, and **Refresh** moves into the header (disabled while a build runs).
- On those hosts the view no longer draws its own "Library Statistics" title row; older hosts keep it unchanged. No `minAppVersion` bump.

## v1.5.0
- Initial release. Externalized from the Viboplr app's built-in plugins (previously bundled as `library-stats`); functionally identical, now installable and updatable from the plugin gallery.
