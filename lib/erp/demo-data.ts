import type { ErpModuleId, ErpRole, ErpSiteId } from "@/domain/erp";
import { ERP_ACCOUNTANT_MODULE_IDS } from "@/domain/erp-role-policy";

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

const directorPassword =
  process.env.ERP_DEMO_DIRECTOR_PASSWORD ?? "Giamdoc@2026";
const managerPassword =
  process.env.ERP_DEMO_MANAGER_PASSWORD ?? "Quanly@2026";
const employeePassword =
  process.env.ERP_DEMO_EMPLOYEE_PASSWORD ?? "Nhanvien@2026";
const accountantPassword =
  process.env.ERP_DEMO_ACCOUNTANT_PASSWORD ?? "Ketoan@2026";
const chiefAccountantPassword =
  process.env.ERP_DEMO_CHIEF_ACCOUNTANT_PASSWORD ?? "Ketoantruong@2026";
const seasonalPassword =
  process.env.ERP_DEMO_SEASONAL_PASSWORD ?? "Thoivu@2026";

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
    initialModuleIds: [],
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
    initialModuleIds: [],
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
    initialModuleIds: [],
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
    initialModuleIds: [],
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
      accessStartsAt: "2026-07-20T00:00:00+07:00",
      accessEndsAt: "2026-08-31T23:59:59+07:00",
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
