# replicas_mvc.ps1 — 11/11 (rama mvc-borrador, decisión de Miche): ¿el esqueleto MVC (--mvc) ayuda?
# Igual que replicas_rol.ps1: 3 réplicas de cada versión, INTERCALADAS (sin s1, mvc s1, sin s2, ...) para que cualquier
# cambio de la PC les pegue a las dos por igual. Cada réplica: la hoja de cálculo desde cero, de a poco, mismas vueltas,
# temperatura 0.7 y una semilla distinta. Al final, build\resumen_replicas.mjs juzga cada app final y arma la tabla.
# Uso, desde E:\Proyectos 2026\webmcp:
#   powershell -ExecutionPolicy Bypass -File build\replicas_mvc.ps1
param([int]$Vueltas = 30, [double]$Temperatura = 0.7, [string]$Base = "build\proyectos\2026-11-10T00-22-03_hoja_limpia")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:CICLO_TEMPERATURA = "$Temperatura"
Remove-Item Env:SPECIALIST_MODEL -ErrorAction SilentlyContinue   # el modelo sale de PUESTOS.md

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$lista = "build\replicas_mvc_$stamp.txt"
$corridas = foreach ($s in 1..3) {
  @{ nombre = "rep_sin_s$s"; semilla = $s; flags = @() }           # como hoy (el Role solo en el borrador)
  @{ nombre = "rep_mvc_s$s"; semilla = $s; flags = @("--mvc") }
}
function Anotar($texto) { $texto; Add-Content -Path $lista -Value $texto -Encoding UTF8 }

Anotar "== réplicas MVC: $($corridas.Count) corridas, $Vueltas vueltas, temperatura $Temperatura, base $Base"
foreach ($c in $corridas) {
  $env:CICLO_SEMILLA = "$($c.semilla)"
  $salida = & node build/proyecto.mjs copiar $Base $c.nombre 2>&1 | Out-String
  if ($salida -notmatch '([A-Z]:\\.*?\\build\\proyectos\\\S+)') { Anotar "NO PUDE COPIAR $($c.nombre): $salida"; continue }
  $carpeta = $Matches[1].Trim()
  Anotar "$(Get-Date -Format 'HH:mm') EMPIEZA $($c.nombre) (semilla $($c.semilla)) -> $carpeta"
  $consola = Join-Path $carpeta "consola.txt"
  $f = $c.flags
  & node build/proyecto.mjs seguir $carpeta --de-a-poco --max-vueltas $Vueltas @f 2>&1 | ForEach-Object { "$_"; Add-Content -Path $consola -Value "$_" -Encoding UTF8 }
  Anotar "$(Get-Date -Format 'HH:mm') TERMINA $($c.nombre)"
}
Anotar "== corridas listas. Juzgo las apps finales…"
& node build/resumen_replicas.mjs $lista 2>&1 | ForEach-Object { Anotar "$_" }
Anotar "== LISTO. Todo quedó en $lista"
