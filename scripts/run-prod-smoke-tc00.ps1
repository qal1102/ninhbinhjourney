# Chạy ba smoke production của TC-00: A6 (verdict phát hành), A3 (cổng ngoại
# tuyến), A5 (bảng phễu). Cả ba đều CHỈ ĐỌC, không ghi gì vào production.
#
# Script tự hỏi mật khẩu bằng Read-Host -AsSecureString, nên mật khẩu KHÔNG
# hiện trên màn hình, KHÔNG vào lịch sử lệnh, KHÔNG được ghi xuống đĩa. Biến
# môi trường chỉ sống trong tiến trình này và mất khi script kết thúc.
#
# Cách chạy, từ bất kỳ thư mục nào:
#   powershell -ExecutionPolicy Bypass -File d:\ninhbinh\scripts\run-prod-smoke-tc00.ps1

$ErrorActionPreference = "Stop"

# Đứng đúng gốc repo, nếu không Playwright không tìm thấy playwright.config.ts.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Host "Thu muc: $repoRoot"

$cli = Join-Path $repoRoot "node_modules\@playwright\test\cli.js"
if (-not (Test-Path $cli)) {
  throw "Khong tim thay Playwright CLI tai $cli. Chay 'npm install' truoc."
}

function Read-PlainSecret([string]$prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# Hoi hai lan va doi chieu. O nhap an khong hien ky tu nao, nen mot phim lech
# la mot luot chay 40 giay do voi thong bao "Ten dang nhap hoac mat khau khong
# dung" -- trong y het he thong hong. Da xay ra that ngay 26/08.
$first  = Read-PlainSecret "Mat khau tai khoan giamdoc tren production"
$second = Read-PlainSecret "Nhap lai de xac nhan"

if ([string]::IsNullOrWhiteSpace($first)) {
  throw "Chua nhap mat khau."
}
if ($first -cne $second) {
  throw "Hai lan nhap khong khop. Chay lai script va go lai."
}

Write-Host ("Da nhan mat khau: {0} ky tu." -f $first.Length)
$env:ERP_DEMO_DIRECTOR_PASSWORD = $first

# PLAYWRIGHT_BASE_URL phai dat tuong minh. Thieu no thi Playwright tu dung
# server cuc bo va test nham moi truong -- loi nay da tung tao ra mot bao cao
# "loi nghiem trong" gia.
$env:PLAYWRIGHT_BASE_URL       = "https://ninhbinhjourney.vercel.app"
$env:NBJ_A6_RELEASE_SMOKE      = "1"
$env:NBJ_A6_RELEASE_EXPECTATION = "canary-ready"
$env:NBJ_A3_OFFLINE_SMOKE      = "1"
$env:NBJ_A5_FUNNEL_SMOKE       = "1"

try {
  & node $cli test `
    tests/e2e/prod-smoke-customer-release-readiness.spec.ts `
    tests/e2e/prod-smoke-a3-offline-gate.spec.ts `
    tests/e2e/prod-smoke-a5-funnel.spec.ts `
    --reporter=list
  $code = $LASTEXITCODE
} finally {
  # Xoa ngay, ke ca khi test do. PLAYWRIGHT_BASE_URL con sot lai la nguy hiem
  # nhat: lan sau chay test cuc bo se am tham ban vao production.
  $first  = $null
  $second = $null
  $env:ERP_DEMO_DIRECTOR_PASSWORD = $null
  $env:PLAYWRIGHT_BASE_URL        = $null
  $env:NBJ_A6_RELEASE_SMOKE       = $null
  $env:NBJ_A6_RELEASE_EXPECTATION = $null
  $env:NBJ_A3_OFFLINE_SMOKE       = $null
  $env:NBJ_A5_FUNNEL_SMOKE        = $null
}

Write-Host ""
if ($code -eq 0) {
  Write-Host "Ket qua: XANH. Gui toan bo output nay cho Claude."
} else {
  Write-Host "Ket qua: DO (exit $code). Gui toan bo output nay cho Claude -- do la thong tin can thiet, khong phai that bai."
}
exit $code
