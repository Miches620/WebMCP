# Intent Forge v0.2.1 - MicheLab Skill
# Uso:.\intent_forge_v02.ps1 -Prompt "Quiero hacer una web de instrumentos"
# Fix: sin brackets en Write-Host y sin backticks literales en replace
#
# OJO: esto es una herramienta manual para correr Intent Forge sola desde
# una terminal (útil para debug rápido). El pipeline real de webmcp NO
# llama a este script: server.mjs tiene su propio SYSTEM prompt inline en
# /api/intent-forge, que es el que corre de verdad cuando usás la interfaz.
# Si tocás una regla acá, actualizá también la de server.mjs a mano.

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [string]$OutputFile = ".\refined_prompt.json",
    [string]$AnswerKeyFile = ".\answer_key_requirements.json",
    [string]$ConversationLog = ".\intent_conversation.json",
    [string]$LMStudioUrl = "http://localhost:1234/v1/chat/completions",
    [string]$Model = "qwen2.5-7b-instruct"
)

$SYSTEM_PROMPT = @"
Sos Intent Forge v0.2 - Analista de requisitos del Equipo MicheLab.

Tu laburo NO es inventar un número fijo de features. Tu laburo es:
1. Entender que quiere construir el usuario
2. Hacer preguntas atómicas para no asumir
3. Generar el answer_key: lista de requisitos ATOMICOS necesarios para pasar el hold-out, sin agrupar ni omitir

REGLAS DURAS:
- NUNCA digas "llegar a 9 features" o "no 5 agrupados". El número lo definen LOS REQUISITOS del proyecto, no vos.
- Si el proyecto pide 3 features claras, son 3. Si pide 15, son 15. No inventes ni recortes.
- Una feature atomica = 1 capacidad verificable en el hold-out. No agrupes "CRUD completo" en 1, separalo si el prompt lo pide implicito.
- No muestres el refined_prompt crudo en el chat. En el chat solo decis lo que interpretaste y que preguntas tenes. El refined_prompt va a archivo.
- Cuando consideres que tenes suficiente info, respondé con la palabra clave FINAL: ```json y el refined_prompt completo

FORMATO DE SALIDA CUANDO ESTES COMPLETE:
\`\`\`json
{
  "status": "COMPLETE",
  "refined_prompt": {
    "project_name": "...",
    "objetivo": "... descripcion rica...",
    "features": ["feature atomica 1", "feature atomica 2", ...],
    "criterios_holdout": ["como se verifica cada una"]
  }
}
\`\`\`
Si NO estas complete, preguntá 1-2 cosas puntuales, nada más.

Max iteraciones: 10. Objetivo: atomizar sin inventar.
"@

$conversation = @(
    @{ role = "system"; content = $SYSTEM_PROMPT },
    @{ role = "user"; content = $Prompt }
)

Write-Host "INTENT FORGE v0.2.1 Activado" -ForegroundColor Cyan
Write-Host "Prompt inicial: $Prompt" -ForegroundColor Yellow
Write-Host ""

$maxIterations = 10
$iteration = 0
$bt = [char]96

while ($iteration -lt $maxIterations) {
    $iteration++
    Write-Host "--- Iteracion $iteration ---" -ForegroundColor DarkGray

    $isLikelyFinal = $iteration -ge 3
    $currentMaxTokens = if ($isLikelyFinal) { 1200 } else { 400 }

    $body = @{
        model = $Model
        messages = $conversation
        temperature = 0.3
        max_tokens = $currentMaxTokens
    } | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Uri $LMStudioUrl -Method Post -ContentType "application/json" -Body $body
        $assistantMessage = $response.choices[0].message.content

        Write-Host "Intent Forge: $assistantMessage" -ForegroundColor Green
        Write-Host ""

        $conversation += @{ role = "assistant"; content = $assistantMessage }

        if ($assistantMessage -match '"status":\s*"COMPLETE"') {
            Write-Host "OK Prompt refinado completado" -ForegroundColor Cyan

            $cleaned = $assistantMessage.Trim()
            $cleaned = $cleaned -replace "$bt$bt$bt", ""

            $jsonMatch = [regex]::Match($cleaned, '\{[\s\S]*\}')
            if ($jsonMatch.Success) {
                try {
                    $parsed = $jsonMatch.Value | ConvertFrom-Json

                    $parsed | ConvertTo-Json -Depth 10 | Set-Content $OutputFile -Encoding UTF8
                    Write-Host "GUARDADO Refined prompt en: $OutputFile" -ForegroundColor Yellow

                    if ($parsed.refined_prompt.features) {
                        $requirements = @()
                        $idx = 1
                        foreach ($f in $parsed.refined_prompt.features) {
                            $requirements += @{
                                id = "R$idx"
                                text = $f
                            }
                            $idx++
                        }
                        $requirements | ConvertTo-Json -Depth 5 | Set-Content $AnswerKeyFile -Encoding UTF8
                        Write-Host "GUARDADO Answer key en: $AnswerKeyFile" -ForegroundColor Yellow
                    }

                    $conversation | ConvertTo-Json -Depth 10 | Set-Content $ConversationLog -Encoding UTF8
                    Write-Host "LOG Conversacion en: $ConversationLog" -ForegroundColor DarkGray

                    exit 0
                } catch {
                    Write-Host "ERROR JSON invalido" -ForegroundColor Red
                    Write-Host $_ -ForegroundColor Red
                }
            } else {
                Write-Host "ERROR No se encontro JSON en la respuesta" -ForegroundColor Red
            }
        }

        $userResponse = Read-Host "Tu respuesta"
        $conversation += @{ role = "user"; content = $userResponse }

    } catch {
        Write-Host "ERROR $_" -ForegroundColor Red
        $conversation | ConvertTo-Json -Depth 10 | Set-Content $ConversationLog -Encoding UTF8
        exit 1
    }
}

Write-Host "WARN Maximo de iteraciones alcanzado" -ForegroundColor Yellow
$conversation | ConvertTo-Json -Depth 10 | Set-Content $ConversationLog -Encoding UTF8