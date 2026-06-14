#!/usr/bin/env bash
# Locate the source of the web deployment's AI_PROVIDER value so we flip the
# right place to make Anthropic the primary tutor provider.
set -euo pipefail
NS=aivo

kubectl -n "$NS" get deploy web -o json > /tmp/web-deploy.json

python3 - <<'PY'
import json
with open("/tmp/web-deploy.json") as fh:
    d = json.load(fh)
c = d["spec"]["template"]["spec"]["containers"][0]
keys = {"AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "NODE_ENV"}
print("=== web deployment inline env (AI-related) ===")
for e in c.get("env", []):
    if e["name"] in keys:
        if "value" in e:
            print("  inline  {0} = {1}".format(e["name"], e["value"]))
        elif "valueFrom" in e:
            ref = e["valueFrom"].get("secretKeyRef") or e["valueFrom"].get("configMapKeyRef") or {}
            kind = "secret" if "secretKeyRef" in e["valueFrom"] else "configmap"
            print("  inline  {0} <- {1} {2}:{3}".format(e["name"], kind, ref.get("name"), ref.get("key")))
froms = []
for f in c.get("envFrom", []):
    r = f.get("secretRef") or f.get("configMapRef") or {}
    froms.append(r.get("name"))
print("  envFrom:", froms)
PY
