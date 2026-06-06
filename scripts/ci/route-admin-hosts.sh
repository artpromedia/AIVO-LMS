#!/usr/bin/env bash

set -euo pipefail

: "${NAMESPACE:?NAMESPACE is required}"

service_name="${SERVICE_NAME:-web-admin}"
hosts=(admin.aivolearning.com district.aivolearning.com)

command -v kubectl >/dev/null || {
  echo "::error title=Missing dependency::kubectl is required to route admin hosts"
  exit 1
}
command -v jq >/dev/null || {
  echo "::error title=Missing dependency::jq is required to route admin hosts"
  exit 1
}

for host in "${hosts[@]}"; do
  matches="$(
    kubectl -n "$NAMESPACE" get ingress -o json |
      jq -r --arg host "$host" '
        .items[] as $ingress
        | $ingress.spec.rules
        | to_entries[]
        | select(.value.host == $host)
        | .key as $rule_index
        | .value.http.paths
        | to_entries[]
        | select(.value.path == "/")
        | [$ingress.metadata.name, $rule_index, .key] | @tsv
      '
  )"

  if [[ -z "$matches" ]]; then
    echo "::error title=Admin host ingress missing::No / ingress rule for ${host} exists in namespace ${NAMESPACE}"
    exit 1
  fi

  if [[ "$(printf '%s\n' "$matches" | wc -l)" -ne 1 ]]; then
    echo "::error title=Admin host ingress ambiguous::Expected one / ingress rule for ${host} in namespace ${NAMESPACE}"
    exit 1
  fi

  IFS=$'\t' read -r ingress_name rule_index path_index <<<"$matches"
  patch="[{\"op\":\"replace\",\"path\":\"/spec/rules/${rule_index}/http/paths/${path_index}/backend/service/name\",\"value\":\"${service_name}\"}]"
  kubectl -n "$NAMESPACE" patch ingress "$ingress_name" --type=json -p "$patch"
  echo "${host} -> ${NAMESPACE}/${service_name}"
done
