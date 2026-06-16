# provision-sentry-live.ps1 — wire the live Sentry DSN into the AIVO prod cluster.
#
# Prompts for the DSN locally (never echoed, never in shell history / process args),
# then pipes it over SSH to /opt/aivo-deploy/set-web-sentry-dsn.sh which:
#   1. patches SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN into aivo-common-env (prod + staging)
#   2. sets both env vars on the `web` deployment (triggers rollout)
#   3. waits for rollout + smoke-tests https://aivolearning.com
#
# Get the DSN from sentry.io -> Project Settings -> Client Keys (DSN).
# Format: https://<key>@o<org>.ingest.sentry.io/<project-id>
#
# Usage:  .\provision-sentry-live.ps1
#         .\provision-sentry-live.ps1 -DsnFile C:\path\to\dsn.txt   (file with DSN on line 1)

[CmdletBinding()]
param(
    [string]$DsnFile,
    [string]$SshKey = "$env:USERPROFILE\.ssh\id_ed25519",
    [string]$SshHost = "root@95.216.245.40"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- 1. Acquire DSN -------------------------------------------------------
if ($DsnFile) {
    if (-not (Test-Path $DsnFile)) { throw "DSN file not found: $DsnFile" }
    $dsn = (Get-Content $DsnFile -First 1).Trim()
} else {
    $secure = Read-Host -Prompt "Paste Sentry DSN (input hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $dsn = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# --- 2. Validate shape (https://<key>@<host>/<project-id>) ----------------
if ($dsn -notmatch '^https://[0-9a-f]+@[a-z0-9.-]+\.sentry\.io/\d+$' -and
    $dsn -notmatch '^https://[^@/\s]+@[^/\s]+/\d+$') {
    throw "That doesn't look like a Sentry DSN (expected https://<key>@<host>/<project-id>)."
}

$sha = [System.Security.Cryptography.SHA256]::Create()
$fp = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($dsn))) `
        -replace '-', '').Substring(0, 12).ToLower()
Write-Host "DSN accepted. fingerprint sha256[:12]=$fp" -ForegroundColor Green

# --- 3. Ensure server has the latest apply script -------------------------
$bashScript = Join-Path $repoRoot "set-web-sentry-dsn.sh"
if (-not (Test-Path $bashScript)) { throw "Missing $bashScript" }
Write-Host "Uploading set-web-sentry-dsn.sh to $SshHost ..." -ForegroundColor Cyan
scp -i $SshKey $bashScript "${SshHost}:/opt/aivo-deploy/set-web-sentry-dsn.sh" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "scp failed (exit $LASTEXITCODE)" }

# --- 4. Apply: pipe DSN via stdin (keeps it out of argv on both sides) ----
Write-Host "Applying DSN to cluster + rolling out web (this waits for rollout)..." -ForegroundColor Cyan
$dsn | ssh -i $SshKey $SshHost "bash /opt/aivo-deploy/set-web-sentry-dsn.sh -"
$exit = $LASTEXITCODE
$dsn = $null

if ($exit -ne 0) {
    Write-Host "FAILED (exit $exit). Old web pod keeps serving - no outage. Check: kubectl -n aivo get pods | grep ^web-" -ForegroundColor Red
    exit $exit
}
Write-Host "Done. Sentry DSN provisioned and web rollout converged." -ForegroundColor Green
