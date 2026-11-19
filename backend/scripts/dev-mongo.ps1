<#
.SYNOPSIS
  Chạy MongoDB cục bộ dạng replica set một node (cần cho transaction) để phát triển và chạy kiểm thử.

.DESCRIPTION
  Lần đầu tải MongoDB Community + mongosh bản zip (không cần quyền admin) vào backend/.dev/, kiểm tra SHA-256,
  rồi chạy `mongod --replSet rs0 --port 27117` và khởi tạo replica set.
  Dữ liệu ở backend/.dev/data, log ở backend/.dev/log (đã có trong .gitignore).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File backend/scripts/dev-mongo.ps1
  powershell -ExecutionPolicy Bypass -File backend/scripts/dev-mongo.ps1 -Stop
#>
param(
  [int]$Port = 27117,
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$dev = Join-Path (Split-Path $PSScriptRoot -Parent) '.dev'
$mongod = Join-Path $dev 'mongodb\bin\mongod.exe'
$mongosh = Join-Path $dev 'mongosh\bin\mongosh.exe'

if ($Stop) {
  Get-Process mongod -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $mongod } | Stop-Process -Confirm:$false
  Write-Host 'Đã dừng mongod.'
  return
}

New-Item -ItemType Directory -Force (Join-Path $dev 'data'), (Join-Path $dev 'log'), (Join-Path $dev 'dl') | Out-Null

if (-not (Test-Path $mongod)) {
  Write-Host 'Tải MongoDB Community 8.0 (một lần)...'
  $index = (Invoke-WebRequest -Uri 'https://downloads.mongodb.org/current.json' -UseBasicParsing).Content | ConvertFrom-Json
  $ver = $index.versions | Where-Object { $_.production_release -and $_.version -match '^8\.0\.' } | Select-Object -First 1
  $pkg = $ver.downloads | Where-Object { $_.target -eq 'windows' -and $_.arch -eq 'x86_64' -and $_.edition -eq 'base' } | Select-Object -First 1
  $zip = Join-Path $dev 'dl\mongodb.zip'
  Invoke-WebRequest -Uri $pkg.archive.url -OutFile $zip -UseBasicParsing
  if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $pkg.archive.sha256) { throw 'Sai checksum MongoDB' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  New-Item -ItemType Directory -Force (Split-Path $mongod) | Out-Null
  $z = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try { foreach ($e in $z.Entries) { if ($e.Name -eq 'mongod.exe') { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $mongod, $true) } } } finally { $z.Dispose() }
  Remove-Item $zip
}
if (-not (Test-Path $mongosh)) {
  Write-Host 'Tải mongosh (một lần)...'
  $rel = (Invoke-WebRequest -Uri 'https://api.github.com/repos/mongodb-js/mongosh/releases/latest' -UseBasicParsing -Headers @{ 'User-Agent' = 'dev-setup' }).Content | ConvertFrom-Json
  $asset = $rel.assets | Where-Object { $_.name -match '^mongosh-[\d\.]+-win32-x64\.zip$' } | Select-Object -First 1
  $zip = Join-Path $dev 'dl\mongosh.zip'
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  New-Item -ItemType Directory -Force (Split-Path $mongosh) | Out-Null
  $z = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try { foreach ($e in $z.Entries) { if ($e.FullName -match '/bin/' -and $e.Name) { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path (Split-Path $mongosh) $e.Name), $true) } } } finally { $z.Dispose() }
  Remove-Item $zip
}

$running = Get-Process mongod -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $mongod }
if (-not $running) {
  Start-Process -FilePath $mongod -WindowStyle Hidden -ArgumentList @(
    '--replSet', 'rs0', '--port', $Port, '--bind_ip', '127.0.0.1',
    '--dbpath', (Join-Path $dev 'data'), '--logpath', (Join-Path $dev 'log\mongod.log'), '--logappend',
    '--wiredTigerCacheSizeGB', '0.5'
  ) | Out-Null
  Start-Sleep -Seconds 4
}
& $mongosh --quiet --port $Port --eval "try { rs.status().ok } catch (e) { rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:$Port'}]}).ok }" | Out-Null
Write-Host "MongoDB sẵn sàng: mongodb://127.0.0.1:$Port/?replicaSet=rs0&directConnection=true"
