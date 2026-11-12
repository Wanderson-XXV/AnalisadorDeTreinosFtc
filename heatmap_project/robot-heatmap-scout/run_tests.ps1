$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (Get-Command py -ErrorAction SilentlyContinue) {
    py -3 -m pytest
} else {
    python -m pytest
}
