# Vendored marketing fonts

These WOFF2 files are loaded by `apps/marketing/src/app/layout.tsx` via
`next/font/local` so the production and developer builds never have to reach
Google Fonts (build-time fetch fails behind corporate TLS / sandboxed CI).

## Files

- `InterVariable.woff2` — Inter v4 variable (100–900). Source:
  https://rsms.me/inter/font-files/InterVariable.woff2
  License: SIL Open Font License 1.1 (https://github.com/rsms/inter/blob/master/LICENSE.txt)
- `AtkinsonHyperlegible-Regular.woff2` / `AtkinsonHyperlegible-Bold.woff2` —
  Atkinson Hyperlegible from the Braille Institute. Source:
  https://github.com/googlefonts/atkinson-hyperlegible/tree/main/fonts/webfonts
  License: SIL Open Font License 1.1

## Refreshing

PowerShell:

```powershell
$dst = "apps/marketing/src/fonts"
Invoke-WebRequest -UseBasicParsing `
  -Uri "https://rsms.me/inter/font-files/InterVariable.woff2" `
  -OutFile "$dst/InterVariable.woff2"

$base = "https://github.com/googlefonts/atkinson-hyperlegible/raw/main/fonts/webfonts"
foreach ($f in "AtkinsonHyperlegible-Regular.woff2","AtkinsonHyperlegible-Bold.woff2") {
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$f" -OutFile "$dst/$f"
}
```

Bash:

```bash
dst=apps/marketing/src/fonts
curl -L -o "$dst/InterVariable.woff2" https://rsms.me/inter/font-files/InterVariable.woff2
base=https://github.com/googlefonts/atkinson-hyperlegible/raw/main/fonts/webfonts
for f in AtkinsonHyperlegible-Regular.woff2 AtkinsonHyperlegible-Bold.woff2; do
  curl -L -o "$dst/$f" "$base/$f"
done
```
