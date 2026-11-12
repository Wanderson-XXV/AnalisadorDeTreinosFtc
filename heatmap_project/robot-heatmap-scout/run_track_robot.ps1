param(
    # [string]$Calibration = "calibrations/decode_v1.yaml",
    [string]$Calibration = "calibrations/decode_sala_camera_quadro_1.yaml",
    [string]$Video = "..\robot-heatmap-scout\videos\teste_robo.mp4",
    [string]$AnalysisDir = "",
    [string]$Output = "",
    [ValidateSet("CSRT", "KCF")]
    [string]$Tracker = "CSRT",
    [ValidateSet("1", "2", "4", "8", "max")]
    [string]$Speed = "4"
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

$ArgsList = @("scripts/track_robot.py", "--calibration", $Calibration, "--tracker", $Tracker, "--speed", $Speed)
if ($Video) {
    $ArgsList += @("--video", $Video)
}
if ($AnalysisDir) {
    $ArgsList += @("--analysis-dir", $AnalysisDir)
}
if ($Output) {
    $ArgsList += @("--output", $Output)
}

Write-Host "Tracking com calibracao: $Calibration"
Write-Host "Tracker: $Tracker"
Write-Host "Velocidade: $Speed"
if ($Video) {
    Write-Host "Video: $Video"
}
if ($AnalysisDir) {
    Write-Host "Pasta da analise: $AnalysisDir"
}
if ($Output) {
    Write-Host "Saida: $Output"
} else {
    Write-Host "Saida: <analysis-dir>/positions.csv"
}
& $PythonCommand @PythonPrefix @ArgsList
