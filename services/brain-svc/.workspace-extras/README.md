# Workspace-level Python dependency files (archived)

These files used to live at the repository root:
- `pyproject.toml` — workspace-level Python dependencies
- `uv.lock` — uv lockfile

They were moved here because their presence at the root caused Replit's
deploy pipeline to run `uv sync` into the read-only Nix store, which
fails with `Permission denied` and aborts the build.

The runtime services that actually need these dependencies use their own
`requirements.txt`:
- `services/brain-svc/requirements.txt`
- `services/ai-svc/requirements.txt`

If you want to restore the root-level workspace install for local
development with `uv`, copy these two files back to the repository root.
