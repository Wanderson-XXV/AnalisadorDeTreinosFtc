param(
    [string]$Field = "configs/fields/decode.yaml",
    [string]$Image = "assets/arenas/decode_hd_2.png",
    [ValidateSet("normalized", "cm")]
    [string]$Unit = "cm",
    [double]$FieldWidth = 365.76,
    [double]$FieldHeight = 365.76,
    [switch]$New
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCommand = "py"
    $PythonPrefix = @("-3")
} else {
    $PythonCommand = "python"
    $PythonPrefix = @()
}

if ((Test-Path -LiteralPath $Field) -and -not $New) {
    Write-Host "Abrindo arena existente: $Field"
    & $PythonCommand @PythonPrefix scripts/arena_configurator.py --output $Field --load $Field
} else {
    Write-Host "Criando nova arena em: $Field"
    & $PythonCommand @PythonPrefix scripts/arena_configurator.py --image $Image --output $Field --unit $Unit --field-width $FieldWidth --field-height $FieldHeight
}
