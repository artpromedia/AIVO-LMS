# Inclusive-mode fonts

## OpenDyslexic

This package references the [OpenDyslexic](https://opendyslexic.org/) font
under the SIL Open Font License, version 1.1 (commercial use permitted,
attribution preserved in the license file).

We do **not** ship the font binary in the repo to keep the package small.
`DyslexiaFontProvider` references the OpenDyslexic file via the public
jsDelivr CDN URL by default. Apps that need fully offline support should
self-host the font under `/fonts/OpenDyslexic-Regular.woff2` and pass
`fontUrl="/fonts/OpenDyslexic-Regular.woff2"` to the provider.

To self-host:

1. Download the .woff/.woff2 files from <https://opendyslexic.org/>.
2. Place them in your app's `public/fonts/` directory.
3. Copy the `OFL.txt` license file alongside the font files.
4. Pass `fontUrl` to `DyslexiaFontProvider`.

## TODO

When we standardize on a single self-hosted version across all apps we
should add the binary here and ship the OFL.txt file in this directory.
Tracked as a follow-up after Sprint 15.
