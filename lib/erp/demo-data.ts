import { ERP_MODULES, type ErpModuleId, type ErpRole, type ErpSiteId } from "@/domain/erp";
import {
  ERP_ACCOUNTANT_MODULE_IDS,
  ERP_MANAGER_BASE_MODULE_IDS,
} from "@/domain/erp-role-policy";

export type ErpEmploymentType = "permanent" | "seasonal" | "contractor";

export type DemoWorkforceProfile = {
  employmentType: ErpEmploymentType;
  accessStartsAt: string;
  accessEndsAt: string | null;
  supervisorId: string;
  primaryStation: string;
  shiftLabel: string;
  trainedModuleIds: ErpModuleId[];
};

/**
 * Cửa sổ quyền của nhân viên thời vụ, tự trượt theo lịch.
 *
 * Trước đây đây là hai mốc cứng (20/07/2026 → 31/08/2026). Hệ quả: từ
 * 01/09/2026 tài khoản `tv.trangan` **tự khoá vĩnh viễn**, màn hình thời vụ
 * không còn xem được, và bài `erp-access.spec.ts` đỏ vì lý do lịch chứ không
 * phải vì sản phẩm. Hạn quyền hết hiệu lực là **tính năng thật** đang chạy —
 * cái sai là dữ liệu trình diễn neo vào một ngày rồi chết cứng ở đó.
 *
 * Cửa sổ giờ chạy từ đầu tháng trước tới hết tháng sau, nên hợp đồng mùa vụ
 * lúc nào cũng đang có hiệu lực và lúc nào cũng có ngày kết thúc để chỉ cho
 * khách xem. Lượng tử theo tháng chứ không theo ngày: hai tiến trình khởi
 * động khác ngày trong cùng tháng vẫn ra đúng một kết quả.
 */
function vietnamDateString(year: number, monthIndex: number, day: number, time: string) {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-${String(day).padStart(2, "0")}T${time}+07:00`;
}

export function seasonalAccessWindow(now: Date = new Date()) {
  // Quy về giờ Việt Nam trước khi lấy tháng: máy chủ chạy UTC, và cuối tháng
  // thì hai múi giờ lệch nhau đúng một tháng.
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = vietnam.getUTCFullYear();
  const month = vietnam.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  // Ngày 0 của tháng kế tiếp nữa = ngày cuối của tháng sau.
  const end = new Date(Date.UTC(year, month + 2, 0));
  return {
    accessStartsAt: vietnamDateString(
      start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), "00:00:00",
    ),
    accessEndsAt: vietnamDateString(
      end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), "23:59:59",
    ),
  };
}

const SEASONAL_ACCESS = seasonalAccessWindow();

export type DemoErpAccount = {
  id: string;
  username: string;
  usernameAliases?: string[];
  name: string;
  role: ErpRole;
  jobTitle: string;
  password: string;
  initialSiteIds: ErpSiteId[];
  managedSiteIds: ErpSiteId[];
  initialModuleIds: ErpModuleId[];
  workforceProfile?: DemoWorkforceProfile;
};

/**
 * A15-ACC-02 (audit 15/09/2026, TK-08). The defaults below sit in a public
 * repository next to every username, so they may only ever unlock a local
 * run. On a Vercel deployment a missing variable used to fall back to them
 * silently; now that role's shared-password login is simply closed (an empty
 * password never matches, see `loginErpAction`) and the server logs why.
 * Production has had all six variables set since 22/08/2026, so nothing that
 * works today stops working — this only removes the silent failure mode.
 */
export function resolveDemoPassword(
  envName: string,
  envValue: string | undefined,
  localDefault: string,
  onVercel: boolean,
): string {
  // Returned untrimmed: the deployed value is compared exactly, as before.
  if (envValue?.trim()) return envValue;
  if (!onVercel) return localDefault;
  console.error(
    `[erp] ${envName} is not set on this deployment; that role's shared-password login is closed.`,
  );
  return "";
}

const onVercel = Boolean(process.env.VERCEL);
const directorPassword = resolveDemoPassword(
  "ERP_DEMO_DIRECTOR_PASSWORD", process.env.ERP_DEMO_DIRECTOR_PASSWORD, "Giamdoc@2026", onVercel,
);
const managerPassword = resolveDemoPassword(
  "ERP_DEMO_MANAGER_PASSWORD", process.env.ERP_DEMO_MANAGER_PASSWORD, "Quanly@2026", onVercel,
);
const employeePassword = resolveDemoPassword(
  "ERP_DEMO_EMPLOYEE_PASSWORD", process.env.ERP_DEMO_EMPLOYEE_PASSWORD, "Nhanvien@2026", onVercel,
);
const accountantPassword = resolveDemoPassword(
  "ERP_DEMO_ACCOUNTANT_PASSWORD", process.env.ERP_DEMO_ACCOUNTANT_PASSWORD, "Ketoan@2026", onVercel,
);
const chiefAccountantPassword = resolveDemoPassword(
  "ERP_DEMO_CHIEF_ACCOUNTANT_PASSWORD", process.env.ERP_DEMO_CHIEF_ACCOUNTANT_PASSWORD, "Ketoantruong@2026", onVercel,
);
const seasonalPassword = resolveDemoPassword(
  "ERP_DEMO_SEASONAL_PASSWORD", process.env.ERP_DEMO_SEASONAL_PASSWORD, "Thoivu@2026", onVercel,
);

/**
 * T4. The login screen used to print every username *and* password in the
 * clear, on production. That makes every audit line in this system deniable --
 * "anyone could have signed in as me" is true, and it is the one claim the
 * whole maker-checker design cannot survive. The account list stays visible so
 * a demo is still navigable; the passwords appear only where this is turned on
 * explicitly, and must be off at handover.
 */
export function areDemoPasswordsVisible() {
  return process.env.NEXT_PUBLIC_ERP_SHOW_DEMO_PASSWORDS === "true";
}

export const DEMO_ERP_ACCOUNTS: readonly DemoErpAccount[] = [
  {
    id: "director-001",
    username: "giamdoc",
    name: "Nguyễn Minh Anh",
    role: "director",
    jobTitle: "Giám đốc điều hành",
    password: directorPassword,
    initialSiteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
    managedSiteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
    initialModuleIds: [],
  },
  {
    id: "chief-accountant-001",
    username: "ketoantruong",
    name: "Nguyễn Hải Yến",
    role: "chief-accountant",
    jobTitle: "Kế toán trưởng",
    password: chiefAccountantPassword,
    initialSiteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
    managedSiteIds: [],
    initialModuleIds: [...ERP_ACCOUNTANT_MODULE_IDS],
  },
  {
    id: "accountant-001",
    username: "ketoan",
    name: "Phạm Thu Trang",
    role: "accountant",
    jobTitle: "Kế toán tổng hợp",
    password: accountantPassword,
    initialSiteIds: ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"],
    managedSiteIds: [],
    initialModuleIds: [...ERP_ACCOUNTANT_MODULE_IDS],
  },
  {
    id: "manager-trang-an",
    username: "ql.vanhanh",
    usernameAliases: ["ql.trangan"],
    name: "Lê Hoàng Nam",
    role: "manager",
    jobTitle: "Quản lý vận hành Tràng An",
    password: managerPassword,
    initialSiteIds: ["trang-an"],
    managedSiteIds: ["trang-an"],
    // Tràng An runs the boat piers and the heaviest fixed infrastructure, so
    // this manager also holds assets/acceptance and the SOP drill book.
    initialModuleIds: [...ERP_MANAGER_BASE_MODULE_IDS, "tai-san-bao-tri"],
  },
  {
    id: "manager-tam-chuc",
    username: "ql.tamchuc",
    name: "Trần Đức Long",
    role: "manager",
    jobTitle: "Quản lý vận hành Tam Chúc",
    password: managerPassword,
    initialSiteIds: ["tam-chuc"],
    managedSiteIds: ["tam-chuc"],
    // Tam Chúc is the crowd-scale/festival site: SOP drills plus the shuttle
    // fleet that moves visitors between the gate and the temple complex.
    initialModuleIds: [...ERP_MANAGER_BASE_MODULE_IDS, "xe-trung-chuyen"],
  },
  {
    id: "manager-tam-coc",
    username: "ql.tamcoc",
    name: "Phạm Anh Tuấn",
    role: "manager",
    jobTitle: "Quản lý vận hành Tam Cốc",
    password: managerPassword,
    initialSiteIds: ["tam-coc"],
    managedSiteIds: ["tam-coc"],
    // Smallest operation of the four: base modules plus the shuttle only.
    initialModuleIds: [...ERP_MANAGER_BASE_MODULE_IDS, "xe-trung-chuyen"],
  },
  {
    id: "manager-bai-dinh",
    username: "ql.baidinh",
    name: "Đặng Thị Hương",
    role: "manager",
    jobTitle: "Quản lý vận hành Bái Đính",
    password: managerPassword,
    initialSiteIds: ["bai-dinh"],
    managedSiteIds: ["bai-dinh"],
    // Bái Đính runs the largest electric-shuttle fleet and a big maintained
    // estate, but its drills are led from Tràng An.
    initialModuleIds: [...ERP_MANAGER_BASE_MODULE_IDS, "xe-trung-chuyen", "tai-san-bao-tri"],
  },
  {
    id: "employee-trang-an-01",
    username: "nv.trangan",
    name: "Đỗ Thị Lan",
    role: "employee",
    jobTitle: "Nhân viên đón khách",
    password: employeePassword,
    initialSiteIds: ["trang-an"],
    managedSiteIds: [],
    initialModuleIds: ["ve-dat-cho", "check-in-khach", "bao-cao-hien-truong", "su-co", "cham-cong", "du-an-su-kien"],
    workforceProfile: {
      employmentType: "permanent",
      accessStartsAt: "2024-01-01T00:00:00+07:00",
      accessEndsAt: null,
      supervisorId: "manager-trang-an",
      primaryStation: "Cổng A",
      shiftLabel: "07:30–12:15",
      trainedModuleIds: ["ve-dat-cho", "check-in-khach", "bao-cao-hien-truong", "su-co", "cham-cong", "du-an-su-kien"],
    },
  },
  {
    id: "employee-trang-an-02",
    username: "nv.bentau",
    name: "Bùi Quốc Huy",
    role: "employee",
    jobTitle: "Điều phối bến thuyền",
    password: employeePassword,
    initialSiteIds: ["trang-an"],
    managedSiteIds: [],
    initialModuleIds: ["suc-chua", "bao-cao-hien-truong", "su-co", "cham-cong"],
    workforceProfile: {
      employmentType: "permanent",
      accessStartsAt: "2023-06-01T00:00:00+07:00",
      accessEndsAt: null,
      supervisorId: "manager-trang-an",
      primaryStation: "Bến thuyền trung tâm",
      shiftLabel: "07:30–12:15",
      trainedModuleIds: ["suc-chua", "bao-cao-hien-truong", "su-co", "cham-cong"],
    },
  },
  {
    id: "employee-trang-an-seasonal-01",
    username: "tv.trangan",
    name: "Nguyễn Thảo My",
    role: "employee",
    jobTitle: "Nhân viên thời vụ hỗ trợ cổng",
    password: seasonalPassword,
    initialSiteIds: ["trang-an"],
    managedSiteIds: [],
    initialModuleIds: ["check-in-khach", "bao-cao-hien-truong", "su-co", "cham-cong"],
    workforceProfile: {
      employmentType: "seasonal",
      accessStartsAt: SEASONAL_ACCESS.accessStartsAt,
      accessEndsAt: SEASONAL_ACCESS.accessEndsAt,
      supervisorId: "manager-trang-an",
      primaryStation: "Cổng A · Làn khách đoàn",
      shiftLabel: "08:00–12:00",
      trainedModuleIds: ["check-in-khach", "bao-cao-hien-truong", "su-co", "cham-cong"],
    },
  },
  {
    id: "employee-tam-chuc-01",
    username: "nv.tamchuc",
    name: "Vũ Ngọc Mai",
    role: "employee",
    jobTitle: "Nhân viên xe trung chuyển",
    password: employeePassword,
    initialSiteIds: ["tam-chuc"],
    managedSiteIds: [],
    initialModuleIds: ["xe-trung-chuyen", "bao-cao-hien-truong", "su-co", "cham-cong", "du-an-su-kien"],
    workforceProfile: {
      employmentType: "permanent",
      accessStartsAt: "2024-02-01T00:00:00+07:00",
      accessEndsAt: null,
      supervisorId: "manager-tam-chuc",
      primaryStation: "Bến xe điện",
      shiftLabel: "07:15–12:15",
      trainedModuleIds: ["xe-trung-chuyen", "bao-cao-hien-truong", "su-co", "cham-cong", "du-an-su-kien"],
    },
  },
  {
    id: "employee-tam-coc-01",
    username: "nv.tamcoc",
    name: "Nguyễn Văn Sơn",
    role: "employee",
    jobTitle: "Điều phối bến đò",
    password: employeePassword,
    initialSiteIds: ["tam-coc"],
    managedSiteIds: [],
    initialModuleIds: ["check-in-khach", "bao-cao-hien-truong", "suc-chua", "cham-cong", "du-an-su-kien"],
    workforceProfile: {
      employmentType: "permanent",
      accessStartsAt: "2023-09-01T00:00:00+07:00",
      accessEndsAt: null,
      supervisorId: "manager-tam-coc",
      primaryStation: "Bến đò trung tâm",
      shiftLabel: "07:30–12:30",
      trainedModuleIds: ["check-in-khach", "bao-cao-hien-truong", "suc-chua", "cham-cong", "du-an-su-kien"],
    },
  },
  {
    id: "employee-bai-dinh-01",
    username: "nv.baidinh",
    name: "Lương Thanh Tùng",
    role: "employee",
    jobTitle: "Nhân viên điều phối xe điện",
    password: employeePassword,
    initialSiteIds: ["bai-dinh"],
    managedSiteIds: [],
    initialModuleIds: ["xe-trung-chuyen", "bao-cao-hien-truong", "suc-chua", "cham-cong", "du-an-su-kien"],
    workforceProfile: {
      employmentType: "permanent",
      accessStartsAt: "2024-03-01T00:00:00+07:00",
      accessEndsAt: null,
      supervisorId: "manager-bai-dinh",
      primaryStation: "Điểm đón xe điện",
      shiftLabel: "07:00–12:00",
      trainedModuleIds: ["xe-trung-chuyen", "bao-cao-hien-truong", "suc-chua", "cham-cong", "du-an-su-kien"],
    },
  },
] as const;

export function isDemoErpAccountActive(
  account: DemoErpAccount,
  now = Date.now(),
) {
  const profile = account.workforceProfile;
  if (!profile) return true;
  const startsAt = Date.parse(profile.accessStartsAt);
  const endsAt = profile.accessEndsAt ? Date.parse(profile.accessEndsAt) : Number.POSITIVE_INFINITY;
  return now >= startsAt && now <= endsAt;
}

export function getEmployeeAssignableModuleIds(account: DemoErpAccount) {
  if (account.role !== "employee") return [];
  return account.workforceProfile?.trainedModuleIds ?? account.initialModuleIds;
}

/**
 * Modules a director may tick on/off for this account in the staff-access
 * screen. Employees are limited to what they were trained on; a site manager
 * can be granted any module, because a manager's job scope is an
 * organisational decision rather than a training record.
 */
export function getGrantableModuleIds(account: DemoErpAccount): ErpModuleId[] {
  if (account.role === "employee") return getEmployeeAssignableModuleIds(account);
  if (account.role === "manager") return ERP_MODULES.map((module) => module.id);
  return [];
}

export function findDemoErpAccountById(id: string) {
  return DEMO_ERP_ACCOUNTS.find((account) => account.id === id);
}

export function findDemoErpAccountByUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return DEMO_ERP_ACCOUNTS.find(
    (account) =>
      account.username.toLowerCase() === normalized ||
      account.usernameAliases?.some(
        (alias) => alias.toLowerCase() === normalized,
      ),
  );
}

export function listDemoEmployees() {
  return DEMO_ERP_ACCOUNTS.filter((account) => account.role === "employee");
}

export function listDemoSiteManagers() {
  return DEMO_ERP_ACCOUNTS.filter((account) => account.role === "manager");
}
