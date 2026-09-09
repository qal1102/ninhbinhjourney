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

# Mot mat khau duy nhat: giam doc.
#
# Truoc day bo smoke dang nhap lai bang bon tai khoan khac nhau, nen muon chay
# phai co bon mat khau. Ngay 29/08 thieu ba trong bon: bon bai do o
# /erp/login?error=invalid, trong y het mot hoi quy giao dien vua moi doi bo cuc.
#
# Nguoi van hanh that khong lam vay. Ho dang nhap mot lan bang giam doc roi bam
# "Xem theo vai tro" ngay trong phien. Bo smoke gio di dung duong do: mot mat
# khau, va duong chuyen vai cung duoc kiem luon.
# Chi tiet: tests/e2e/support/erp-role-switch.ts
$password = Read-PlainSecret "Mat khau giamdoc (giam doc)"
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "Chua nhap mat khau giam doc."
}

Write-Host ""
Write-Host ("Da nhan {0} ky tu (khong hien noi dung)." -f $password.Length)
$confirm = Read-Host "Dung chua? (y de chay, phim khac de huy)"
if ($confirm -ne "y") {
  throw "Da huy. Chay lai script va nhap lai."
}

$env:ERP_DEMO_DIRECTOR_PASSWORD = $password

# PLAYWRIGHT_BASE_URL phai dat tuong minh. Thieu no thi Playwright tu dung
# server cuc bo va test nham moi truong -- loi nay da tung tao ra mot bao cao
# "loi nghiem trong" gia.
$env:PLAYWRIGHT_BASE_URL       = "https://ninhbinhjourney.vercel.app"
$env:NBJ_A6_RELEASE_SMOKE      = "1"
$env:NBJ_A6_RELEASE_EXPECTATION = "canary-ready"
$env:NBJ_A3_OFFLINE_SMOKE      = "1"
$env:NBJ_A5_FUNNEL_SMOKE       = "1"

# CHAY MOT LUONG. Khong duoc bo --workers=1 ben duoi.
#
# Cau hinh mac dinh la workers: 4 va fullyParallel: true -- tren may cuc bo
# thi khong sao. O day thi khac: moi luong deu dang nhap CUNG MOT tai khoan
# giam doc that roi CHUYEN VAI tren do. Chuyen vai la trang thai nam o may
# chu chu khong phai trong trinh duyet, nen hai luong song song giam len nhau:
# luong nay tra vai xong thi nut cua luong kia bien mat, no ngoi cho het gio.
#
# Hong o day khong chi la bai kiem do oan. No do o dung buoc don dep
# endRoleSwitch, nen tai khoan giam doc co the KET LAI o vai ke toan tren
# production -- chu du an dang nhap giam doc ma thay man hinh ke toan.
#
# Do ngay 09/09/2026: chay song song do lai duoc 2/2 lan; --workers=1 thi 6/6
# xanh va tai khoan tra ve dung vai.
try {
  & node $cli test `
    tests/e2e/prod-smoke-customer-release-readiness.spec.ts `
    tests/e2e/prod-smoke-a3-offline-gate.spec.ts `
    tests/e2e/prod-smoke-a5-funnel.spec.ts `
    tests/e2e/prod-smoke-t11-capacity-ui.spec.ts `
    --workers=1 `
    --reporter=list
  $code = $LASTEXITCODE
} finally {
  # Xoa ngay, ke ca khi test do. PLAYWRIGHT_BASE_URL con sot lai la nguy hiem
  # nhat: lan sau chay test cuc bo se am tham ban vao production.
  $password = $null
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
