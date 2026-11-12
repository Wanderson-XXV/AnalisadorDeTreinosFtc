param(
    [string]$Video = "..\robot-heatmap-scout\videos\teste_robo.mp4",
    [string]$Field = "configs/fields/decode.yaml",
    [string]$Output = "calibrations/decode_sala_camera_quadro_1.yaml",
    [string]$CheckImage = ""
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

$ArgsList = @("scripts/calibrate_video.py", "--video", $Video, "--field", $Field, "--output", $Output)
if ($CheckImage) {
    $ArgsList += @("--check-image", $CheckImage)
}

Write-Host "Calibrando video: $Video"
Write-Host "Arena: $Field"
Write-Host "Saida: $Output"
& $PythonCommand @PythonPrefix @ArgsList
