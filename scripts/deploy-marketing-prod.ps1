# Deploy apps/marketing to prod (K3s @ Hetzner).
#
# Assumes the slim source tarball already exists on the build node
# (uploaded by deploy-web-prod.ps1). Re-uploads it so the marketing
# build picks up the current local source even if it has changed since
# the last web deploy.
#
# Prereqs: ssh key at $env:USERPROFILE\.ssh\id_ed25519, tar.exe on PATH.

[CmdletBinding()]
param(
  [string]$Host_      = '95.216.245.40',
  [string]$User       = 'root',
  [string]$SshKey     = "$env:USERPROFILE\.ssh\id_ed25519",
  [string]$Tag        = "manual-$(Get-Date -Format yyyyMMddHHmmss)"
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

Write-Host "==> Tag: $Tag" -ForegroundColor Cyan

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

Write-Host '==> Uploading' -ForegroundColor Cyan
& scp @sshOpts $tarball "${sshTarget}:/opt/aivo-deploy/aivo-slim.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'scp tarball failed' }
& scp @sshOpts (Join-Path $PSScriptRoot '_remote-deploy-marketing.sh') "${sshTarget}:/opt/aivo-deploy/_remote-deploy-marketing.sh"
if ($LASTEXITCODE -ne 0) { throw 'scp script failed' }
Invoke-Ssh 'chmod +x /opt/aivo-deploy/_remote-deploy-marketing.sh'

# Extract fresh source so docker build picks up local changes.
Invoke-Ssh 'cd /opt/aivo-deploy && rm -rf AIVO-LMS && mkdir AIVO-LMS && tar -xzf aivo-slim.tar.gz -C AIVO-LMS'

Write-Host '==> Building + rolling out marketing' -ForegroundColor Cyan
Invoke-Ssh "bash /opt/aivo-deploy/_remote-deploy-marketing.sh '$Tag'"

Write-Host '==> Post-deploy pods' -ForegroundColor Cyan
Invoke-Ssh 'kubectl -n aivo get pods -l app.kubernetes.io/name=marketing-svc -o wide'

Write-Host ''
Write-Host "Done. Tag: $Tag" -ForegroundColor Green
Write-Host 'Test:  https://aivolearning.com/login  (should redirect to https://app.aivolearning.com/login)'
