#!/usr/bin/env bash
set -e
echo "== /app/ follow =="
curl -s -L -o /dev/null -w "final=%{http_code} url=%{url_effective}\n" https://aivolearning.com/app/
echo "== marketing default html tag =="
curl -s https://aivolearning.com/ | grep -oE '<html[^>]*>' | head -1
echo "== marketing with aivo_locale=ar cookie =="
curl -s -H 'Cookie: aivo_locale=ar' https://aivolearning.com/ | grep -oE '<html[^>]*>' | head -1
echo "== language switcher snippet (should have NO flag emoji, native names) =="
curl -s https://aivolearning.com/ | grep -oE 'aria-label="[^"]*language[^"]*"|🇺🇸|🇸🇦|🇪🇸' | head -3 || echo "(no flag emoji found — good)"
