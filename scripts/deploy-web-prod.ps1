# Deploy apps/web-v2 to prod (K3s @ Hetzner).
#
# Ships the login-failure fixes:
#   - apps/web-v2/lib/learner/baseline-image.ts   (block in-cluster URLs from leaking to browser)
#   - apps/web-v2/app/error.tsx                   (auto-recover UnrecognizedActionError)
#   - apps/web-v2/next.config.ts                  (doc: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)
#
# On first run, also pins NEXT_SERVER_ACTIONS_ENCRYPTION_KEY on the web Deployment
# so Server Action IDs stay stable across pod replicas and redeploys.
#
# Prereqs: ssh key at $env:USERPROFILE\.ssh\id_ed25519, tar.exe on PATH (Git Bash / Win10+).

[CmdletBinding()]
param(
  [string]$Host_      = '95.216.245.40',
  [string]$User       = 'root',
  [string]$SshKey     = "$env:USERPROFILE\.ssh\id_ed25519",
  [string]$Tag        = "manual-$(Get-Date -Format yyyyMMddHHmmss)",
  [switch]$SkipKeyEnsure
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$sshTarget = "$User@$Host_"
$sshOpts   = @('-i', $SshKey, '-o', 'StrictHostKeyChecking=accept-new')

function Invoke-Ssh([string]$cmd) {
  & ssh @sshOpts $sshTarget $cmd
  if ($LASTEXITCODE -ne 0) { throw "ssh failed (exit $LASTEXITCODE): $cmd" }
}
function Invoke-SshOut([string]$cmd) {
  $out = & ssh @sshOpts $sshTarget $cmd
  if ($LASTEXITCODE -ne 0) { throw "ssh failed (exit $LASTEXITCODE): $cmd" }
  return $out
}

Write-Host "==> Tag: $Tag" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Build a slim source tarball matching the proven server tree layout.
#    Excludes match repo-memory pattern in /memories/repo/aivo-lms-deploy.md
# ---------------------------------------------------------------------------
$tarball = Join-Path $env:TEMP 'aivo-slim.tar.gz'
if (Test-Path $tarball) { Remove-Item $tarball -Force }

Write-Host '==> Tarring source' -ForegroundColor Cyan
$tarArgs = @(
  '--exclude=node_modules',
  '--exclude=.git',
  '--exclude=.next',
  '--exclude=.turbo',
  '--exclude=dist',
  '--exclude=build',
  '--exclude=attached_assets',
  '--exclude=artifacts',
  '--exclude=screenshots',
  '--exclude=playwright-report',
  '--exclude=test-results',
  '-czf', $tarball,
  'apps', 'packages', 'services', 'scripts', 'docker', 'infra', 'e2e', 'tests',
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json',
  'tsconfig.base.json', 'tsconfig.json', 'cspell.json', 'eslint.config.mjs',
  'pyproject.toml', '.dockerignore'
)
& tar @tarArgs
if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
$sizeMb = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
Write-Host "    tarball: $tarball ($sizeMb MB)"

# ---------------------------------------------------------------------------
# 2. Upload tarball + remote driver script.
# ---------------------------------------------------------------------------
Write-Host '==> Uploading' -ForegroundColor Cyan
& scp @sshOpts $tarball "${sshTarget}:/opt/aivo-deploy/aivo-slim.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'scp tarball failed' }
& scp @sshOpts (Join-Path $PSScriptRoot '_remote-deploy-web.sh') "${sshTarget}:/opt/aivo-deploy/_remote-deploy-web.sh"
if ($LASTEXITCODE -ne 0) { throw 'scp script failed' }
Invoke-Ssh 'chmod +x /opt/aivo-deploy/_remote-deploy-web.sh'

# ---------------------------------------------------------------------------
# 3. Build + distribute + roll out via the existing remote script.
#    The remote script also pins NEXT_SERVER_ACTIONS_ENCRYPTION_KEY on first
#    run (skip with -SkipKeyEnsure). Done remotely to avoid PS<->ssh quoting
#    issues with the jsonpath expression.
# ---------------------------------------------------------------------------
Write-Host '==> Building + rolling out' -ForegroundColor Cyan
$skipFlag = if ($SkipKeyEnsure) { '1' } else { '0' }
Invoke-Ssh "SKIP_KEY_ENSURE=$skipFlag bash /opt/aivo-deploy/_remote-deploy-web.sh '$Tag'"

# ---------------------------------------------------------------------------
# 4. Quick post-deploy probe.
# ---------------------------------------------------------------------------
Write-Host '==> Post-deploy pods' -ForegroundColor Cyan
Invoke-Ssh 'kubectl -n aivo get pods -l app.kubernetes.io/name=web -o wide'

Write-Host ''
Write-Host "Done. Tag: $Tag" -ForegroundColor Green
Write-Host 'Test:  https://app.aivolearning.com/login  (force-refresh with Ctrl+Shift+R the first time)'
