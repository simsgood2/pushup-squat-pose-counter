# Autonomous overnight loop wrapper.
# Repeatedly invokes `claude --print` in headless mode. Each invocation = fresh session,
# so rate limits / session resets do not stop the loop — next iteration just picks up
# state from TASKS.md / BLOCKED.md / git.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/overnight-run.ps1
# Stop:  Ctrl+C, or create DONE.flag in repo root, or wait until $maxHours elapsed.

$ErrorActionPreference = "Continue"

# Force UTF-8 for stdout/stderr so Korean output in logs is not mojibake.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

$repoRoot     = Split-Path -Parent $PSScriptRoot
$logFile      = Join-Path $repoRoot "overnight.log"
$doneFlag     = Join-Path $repoRoot "DONE.flag"
$maxHours     = 10
$model        = "claude-sonnet-4-6"
$fallback     = "claude-haiku-4-5-20251001"

# Sleep on generic (non-rate-limit) failure. 15 min default.
$genericFailSleepSec  = 900
# Sleep when rate-limited but cannot parse reset time. 30 min default.
$rateLimitBlindSleep  = 1800
# Buffer added to parsed reset time to avoid hitting limit again immediately.
$rateLimitBufferSec   = 90
# Abort only on persistent NON-rate-limit failures.
$maxGenericFails      = 10

$startTime    = Get-Date
$iteration    = 0
$genericFails = 0

function Write-Log {
  param([string]$msg)
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $msg
  $line | Tee-Object -FilePath $logFile -Append
}

function Parse-RateLimitReset {
  param([string]$text)
  # Matches "resets 4:10am (Asia/Seoul)" / "resets 11:30pm" / "resets 4am" etc.
  if ($text -match "resets?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)") {
    $h = [int]$Matches[1]
    $m = if ($Matches[2]) { [int]$Matches[2] } else { 0 }
    $ampm = $Matches[3].ToLower()
    if ($ampm -eq "pm" -and $h -lt 12) { $h += 12 }
    if ($ampm -eq "am" -and $h -eq 12) { $h = 0 }
    $now = Get-Date
    $reset = Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour $h -Minute $m -Second 0
    # If parsed time is in the past, it's tomorrow.
    if ($reset -lt $now) { $reset = $reset.AddDays(1) }
    return $reset
  }
  return $null
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

  Write-Log "--- Iteration $iteration (elapsed: $([Math]::Round($elapsed.TotalHours, 2))h, genericFails: $genericFails) ---"

  Set-Location $repoRoot

  $output = & claude --print --dangerously-skip-permissions --model $model --fallback-model $fallback $prompt 2>&1
  $exitCode = $LASTEXITCODE
  $outputStr = $output | Out-String
  $outputStr | Tee-Object -FilePath $logFile -Append | Out-Null

  if ($exitCode -eq 0) {
    Write-Log "Iteration $iteration OK."
    $genericFails = 0
    Start-Sleep -Seconds 15
    continue
  }

  # Failure path. Distinguish rate limit from other failures.
  $isRateLimit = $outputStr -match "(session limit|rate.?limit|usage limit|too many requests)"

  if ($isRateLimit) {
    $reset = Parse-RateLimitReset -text $outputStr
    if ($reset) {
      $waitSec = [int](($reset - (Get-Date)).TotalSeconds) + $rateLimitBufferSec
      if ($waitSec -lt 60) { $waitSec = 60 }
      Write-Log "Rate limited. Reset parsed as $($reset.ToString('yyyy-MM-dd HH:mm:ss')). Sleeping ${waitSec}s."
      Start-Sleep -Seconds $waitSec
    } else {
      Write-Log "Rate limited but reset time unparseable. Sleeping ${rateLimitBlindSleep}s."
      Start-Sleep -Seconds $rateLimitBlindSleep
    }
    # Do NOT count rate-limit hits toward abort streak.
    continue
  }

  # Generic failure (npm broke, git issue, claude crashed, etc.).
  $genericFails++
  Write-Log "Iteration $iteration generic FAIL (exit=$exitCode, streak=$genericFails). Sleeping ${genericFailSleepSec}s."
  Start-Sleep -Seconds $genericFailSleepSec

  if ($genericFails -ge $maxGenericFails) {
    Write-Log "$maxGenericFails consecutive non-rate-limit failures. Aborting."
    break
  }
}

$totalElapsed = (Get-Date) - $startTime
Write-Log "=== Loop exited. Total elapsed: $([Math]::Round($totalElapsed.TotalHours, 2))h, iterations: $iteration ==="
