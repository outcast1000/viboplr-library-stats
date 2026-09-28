# Changelog

## v1.6.0
- Adopt the host-drawn view header (Viboplr 1.0.77+). The header's subtitle now sums the library up ("12,340 tracks · 48,211 plays since Mar 2024 · Updated Sep 29, 2026"), a status word shows "Computing… 42%" during a build or "Failed" after an error, and **Refresh** moves into the header (disabled while a build runs).
- On those hosts the view no longer draws its own "Library Statistics" title row; older hosts keep it unchanged. No `minAppVersion` bump.

## v1.5.0
- Initial release. Externalized from the Viboplr app's built-in plugins (previously bundled as `library-stats`); functionally identical, now installable and updatable from the plugin gallery.
