# replicas_rol.ps1 — 10/11 (decisión de Miche): ¿el Role en TODAS las vueltas ayuda o estorba?
# 3 réplicas de cada versión, INTERCALADAS (borrador s1, todas s1, borrador s2, ...) para que cualquier cambio de la PC
# durante la noche les pegue a las dos por igual. Cada réplica: hoja de cálculo desde cero, de a poco, mismas vueltas,
# temperatura 0.7 y una semilla distinta (sin azar, corridas iguales darían lo mismo).
# Uso, desde E:\Proyectos 2026\webmcp:
#   powershell -ExecutionPolicy Bypass -File build\replicas_rol.ps1
param([int]$Vueltas = 30, [double]$Temperatura = 0.7, [string]$Base = "build\proyectos\2026-11-10T00-22-03_hoja_limpia")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:CICLO_TEMPERATURA = "$Temperatura"
Remove-Item Env:SPECIALIST_MODEL -ErrorAction SilentlyContinue   # el modelo sale de PUESTOS.md

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$lista = "build\replicas_rol_$stamp.txt"
$corridas = foreach ($s in 1..3) {
  @{ nombre = "rep_borrador_s$s"; semilla = $s; flags = @() }                  # 11/11: el Role solo en el borrador es lo de siempre
  @{ nombre = "rep_todas_s$s";    semilla = $s; flags = @("--rol-en-todas") }
}
function Anotar($texto) { $texto; Add-Content -Path $lista -Value $texto -Encoding UTF8 }

Anotar "== réplicas del Role: $($corridas.Count) corridas, $Vueltas vueltas, temperatura $Temperatura, base $Base"
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
Anotar "== LISTO. La lista de carpetas quedó en $lista"
