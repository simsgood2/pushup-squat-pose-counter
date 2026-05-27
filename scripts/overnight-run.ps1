# Autonomous overnight loop wrapper.
# Repeatedly invokes `claude --print` in headless mode. Each invocation = fresh session,
# so rate limits / session resets do not stop the loop — next iteration just picks up
# state from TASKS.md / BLOCKED.md / git.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/overnight-run.ps1
# Stop:  Ctrl+C, or create DONE.flag in repo root, or wait until $maxHours elapsed.

$ErrorActionPreference = "Continue"

$repoRoot   = Split-Path -Parent $PSScriptRoot
$logFile    = Join-Path $repoRoot "overnight.log"
$doneFlag   = Join-Path $repoRoot "DONE.flag"
$maxHours   = 10
$model      = "claude-sonnet-4-6"
$fallback   = "claude-haiku-4-5-20251001"

$startTime  = Get-Date
$iteration  = 0
$failStreak = 0

function Write-Log {
  param([string]$msg)
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $msg
  $line | Tee-Object -FilePath $logFile -Append
}

$prompt = @'
You are running autonomously in an unattended overnight loop. NO HUMAN is watching.

1. Read GOAL.md (rules, fallbacks, procedure). Treat it as binding.
2. Read TASKS.md. Pick the FIRST unchecked, non-skipped task.
3. Implement it according to its acceptance criteria.
4. Run the relevant tests (cd web && npm run test, and npm run test:e2e if applicable).
5. If green: update TASKS.md checkbox in the same commit, commit (NO Co-Authored-By trailer). DO NOT push — local commits only.
6. If red after 1 retry: append a short paragraph to BLOCKED.md describing the failure and mark the task SKIPPED in TASKS.md, commit (no push), exit.
7. If all priority tasks done/skipped: create DONE.flag at repo root, commit (no push), exit.
8. NEVER ask the user a question. Apply fallbacks from GOAL.md.
9. Process ONE task per invocation, then exit. The wrapper will invoke you again.

Begin now.
'@

Write-Log "=== Overnight loop started. Model: $model. Max hours: $maxHours. ==="
Write-Log "Repo root: $repoRoot"

while ($true) {
  $iteration++
  $elapsed = (Get-Date) - $startTime

  if (Test-Path $doneFlag) {
    Write-Log "DONE.flag detected. Exiting."
    break
  }

  if ($elapsed.TotalHours -ge $maxHours) {
    Write-Log "Reached maxHours ($maxHours). Exiting."
    break
  }

  Write-Log "--- Iteration $iteration (elapsed: $([Math]::Round($elapsed.TotalHours, 2))h, failStreak: $failStreak) ---"

  Set-Location $repoRoot

  # Invoke Claude Code in headless mode.
  # --print            : non-interactive, write response to stdout and exit
  # --dangerously-skip-permissions : auto-grant all tool permissions (no human to approve)
  # --model            : pin to Sonnet for cost/speed
  $output = & claude --print --dangerously-skip-permissions --model $model --fallback-model $fallback $prompt 2>&1
  $exitCode = $LASTEXITCODE

  $output | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null

  if ($exitCode -eq 0) {
    Write-Log "Iteration $iteration OK."
    $failStreak = 0
    Start-Sleep -Seconds 15
  } else {
    $failStreak++
    # Backoff: 1m, 2m, 4m, 8m, ... capped at 30m. Helps when rate-limited.
    $sleepSec = [Math]::Min(1800, 60 * [Math]::Pow(2, $failStreak - 1))
    Write-Log "Iteration $iteration FAILED (exit=$exitCode, streak=$failStreak). Sleeping ${sleepSec}s."
    Start-Sleep -Seconds $sleepSec

    # Hard stop if 8 failures in a row — something is fundamentally broken.
    if ($failStreak -ge 8) {
      Write-Log "8 consecutive failures. Aborting."
      break
    }
  }
}

$totalElapsed = (Get-Date) - $startTime
Write-Log "=== Loop exited. Total elapsed: $([Math]::Round($totalElapsed.TotalHours, 2))h, iterations: $iteration ==="
