#!/bin/bash
POD="$1"
[ -z "$POD" ] && POD=$(kubectl -n aivo get pods -o name | grep identity-svc-57d4 | head -1 | sed 's|pod/||')
cat > /tmp/h.js <<'EOF'
fetch("http://127.0.0.1:3000/health").then(r=>r.text().then(t=>process.stdout.write(r.status+" "+t))).catch(e=>console.error(e.message))
EOF
kubectl -n aivo cp /tmp/h.js "$POD:/tmp/h.js"
kubectl -n aivo exec "$POD" -- node /tmp/h.js
echo
