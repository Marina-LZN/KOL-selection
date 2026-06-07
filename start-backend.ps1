$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\backend"
uv run python app.py

