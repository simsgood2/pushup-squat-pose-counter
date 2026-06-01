<#
.SYNOPSIS
  T4.8 -> T4.9 비주얼 폴리시를 두 개의 독립 Claude 컨텍스트로 순차 실행한다.

.DESCRIPTION
  각 단계는 `claude -p`(비대화형)로 새 프로세스 = 새 컨텍스트에서 실행되며,
  해당 플랜 파일을 읽어  구현 -> 커밋 & 푸쉬 -> game-redesign-plan.md 갱신까지 수행한다.
  1단계(T4.8)가 exit 0으로 끝나야 2단계(T4.9)로 넘어간다.

  파이프라인: ① 명령 & 플랜 전달 ② 구현 ③ 커밋&푸쉬 ④ game-redesign-plan.md 갱신
              ⑤ 컨텍스트 종료 ⑥ 다음 단계 ①부터

.PARAMETER PermissionMode
  비대화형이라 권한 프롬프트에 응답할 수 없다. git push / npm build까지 무인 실행하려면
  bypassPermissions 가 필요(기본값). 더 안전하게 가려면 acceptEdits 로 바꾸되,
  이 경우 Bash(git/npm) 호출에서 막혀 멈출 수 있다.

.EXAMPLE
  pwsh ./scripts/run-visual-polish.ps1
  # opus + bypassPermissions 로 T4.8 -> T4.9 무인 순차 실행

.EXAMPLE
  pwsh ./scripts/run-visual-polish.ps1 -Model sonnet -PauseBetween
  # 모델 sonnet, 단계 사이 사람이 Enter로 확인 후 진행
#>
[CmdletBinding()]
param(
  [string]$RepoPath = "c:\Codes\JS\pushup-squat-pose-counter",
  [string]$Model = "opus",
  [ValidateSet("acceptEdits", "bypassPermissions", "dontAsk", "auto", "default")]
  [string]$PermissionMode = "bypassPermissions",
  [switch]$PauseBetween
)

# 네이티브 stderr가 종료 오류로 처리되지 않게: 명시적으로 exit code만 검사한다.
$ErrorActionPreference = "Continue"

Set-Location $RepoPath

$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) {
  Write-Host "claude CLI를 PATH에서 찾을 수 없습니다." -ForegroundColor Red
  exit 1
}

$logDir = Join-Path $RepoPath "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$steps = @(
  [pscustomobject]@{
    Name   = "T4.8 (모델/이펙트)"
    Plan   = "docs/plan-T4.8-models-effects.md"
    Prompt = "docs/plan-T4.8-models-effects.md 읽고 그대로 구현해. 미커밋 docs 정리도 함께 커밋&푸쉬하고, docs/game-redesign-plan.md에 T4.8 완료 반영해."
  },
  [pscustomobject]@{
    Name   = "T4.9 (환경/조명/후처리)"
    Plan   = "docs/plan-T4.9-environment-lighting.md"
    Prompt = "docs/plan-T4.9-environment-lighting.md 읽고 그대로 구현해. 끝나면 커밋&푸쉬하고 docs/game-redesign-plan.md에 T4.9 완료 반영해."
  }
)

$idx = 0
foreach ($step in $steps) {
  $idx++
  Write-Host ""
  Write-Host "==================================================================" -ForegroundColor Cyan
  Write-Host (" [{0}/{1}] {2} 시작 (model={3}, perm={4})" -f $idx, $steps.Count, $step.Name, $Model, $PermissionMode) -ForegroundColor Cyan
  Write-Host "==================================================================" -ForegroundColor Cyan

  if (-not (Test-Path $step.Plan)) {
    Write-Host ("플랜 파일이 없습니다: {0}" -f $step.Plan) -ForegroundColor Red
    exit 1
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = Join-Path $logDir ("step{0}-{1}.log" -f $idx, $stamp)

  # 비대화형 실행. 새 프로세스이므로 단계마다 깨끗한 새 컨텍스트.
  # stdout(최종 결과/진행 텍스트)을 콘솔과 로그에 동시 기록.
  & $claude -p $step.Prompt --model $Model --permission-mode $PermissionMode | Tee-Object -FilePath $log
  $code = $LASTEXITCODE

  if ($code -ne 0) {
    Write-Host ("[{0}] 실패 (exit {1}). 이후 단계 중단. 로그: {2}" -f $step.Name, $code, $log) -ForegroundColor Red
    exit $code
  }
  Write-Host ("[{0}] 완료. 로그: {1}" -f $step.Name, $log) -ForegroundColor Green

  if ($PauseBetween -and $idx -lt $steps.Count) {
    Read-Host "다음 단계로 진행하려면 Enter (취소: Ctrl+C)"
  }
}

Write-Host ""
Write-Host "모든 단계 완료 (T4.8 + T4.9)." -ForegroundColor Green
