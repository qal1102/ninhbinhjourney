# Chạy bộ smoke production đợt TC: A6 (verdict phát hành), A3 (cổng ngoại
# tuyến), A5 (bảng phễu) và T11a (sức chứa, TC-01). Tất cả đều CHỈ ĐỌC:
# không spec nào gửi form hay tạo bản ghi trên production.
#
# Script tự hỏi mật khẩu bằng Read-Host -AsSecureString, nên mật khẩu KHÔNG
# hiện trên màn hình, KHÔNG vào lịch sử lệnh, KHÔNG được ghi xuống đĩa. Biến
# môi trường chỉ sống trong tiến trình này và mất khi script kết thúc.
#
# Cách chạy, từ bất kỳ thư mục nào:
#   powershell -ExecutionPolicy Bypass -File d:\ninhbinh\scripts\run-prod-smoke.ps1

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

# Bon vai, khong phai mot.
#
# Bo smoke nay dang nhap bang bon tai khoan khac nhau: A6/A3/A5 va bai dau cua
# T11a dung `giamdoc`, con hai bai con lai cua T11a dung `quan ly`, `nhan vien`
# va `ke toan`. Ngay 22/08 production dat CA SAU bien ERP_DEMO_*_PASSWORD, nen
# bat ky vai nao khong duoc truyen se roi ve chuoi mac dinh va dang nhap that
# bai voi `?error=invalid`.
#
# Ban dau script nay chi hoi mat khau giam doc, va ket qua dung nhu vay: 8 bai
# xanh, 4 bai do -- va 4 bai do trong nhu loi giao dien trong khi that ra la
# thieu mat khau. Cung mot cai bay da lam chet toan bo smoke suot 4 ngay.
#
# O nhap an khong hien ky tu nao, nen script in so ky tu tung vai va hoi xac
# nhan mot lan cho ca bon, thay vi bat go lai tung cai.
$roles = @(
  @{ Env = "ERP_DEMO_DIRECTOR_PASSWORD";   Label = "giamdoc (giam doc)" },
  @{ Env = "ERP_DEMO_MANAGER_PASSWORD";    Label = "ql.* (quan ly co so)" },
  @{ Env = "ERP_DEMO_EMPLOYEE_PASSWORD";   Label = "nv.* (nhan vien)" },
  @{ Env = "ERP_DEMO_ACCOUNTANT_PASSWORD"; Label = "ketoan (ke toan)" }
)

$entered = @{}
foreach ($role in $roles) {
  $value = Read-PlainSecret ("Mat khau {0}" -f $role.Label)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw ("Chua nhap mat khau cho {0}. Ca bon vai deu can thiet." -f $role.Label)
  }
  $entered[$role.Env] = $value
}

Write-Host ""
Write-Host "Da nhan (so ky tu, khong hien noi dung):"
foreach ($role in $roles) {
  Write-Host ("  {0,-22} {1} ky tu" -f $role.Label, $entered[$role.Env].Length)
}
$confirm = Read-Host "Dung chua? (y de chay, phim khac de huy)"
if ($confirm -ne "y") {
  throw "Da huy. Chay lai script va nhap lai."
}

foreach ($role in $roles) {
  Set-Item -Path ("env:" + $role.Env) -Value $entered[$role.Env]
}

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
    tests/e2e/prod-smoke-t11-capacity-ui.spec.ts `
    --reporter=list
  $code = $LASTEXITCODE
} finally {
  # Xoa ngay, ke ca khi test do. PLAYWRIGHT_BASE_URL con sot lai la nguy hiem
  # nhat: lan sau chay test cuc bo se am tham ban vao production.
  $entered = $null
  foreach ($role in $roles) {
    Set-Item -Path ("env:" + $role.Env) -Value $null
  }
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
