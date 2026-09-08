$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.13 이상이 필요합니다. 설치 후 로컬실행.cmd를 다시 실행하세요.'
}
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 이상을 사용하세요.' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw '필수 파일 설치에 실패했습니다.' }
}
& node scripts/local-db.mjs
if ($LASTEXITCODE -ne 0) { throw '로컬 기록 저장소를 준비하지 못했습니다.' }
Write-Host '브라우저에서 http://localhost:3000 을 여세요. 종료하려면 Ctrl+C를 누르세요.'
& npm.cmd run dev -- --port 3000
