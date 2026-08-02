"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ERP_MODULES,
  ERP_SITES,
  type ErpModuleId,
  type ErpRole,
  type ErpSiteId,
} from "@/domain/erp";
import { ERP_ACCOUNTANT_MODULE_IDS } from "@/domain/erp-role-policy";

type RecognitionResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

/**
 * Một lượt trong luồng trợ lý. Giữ lại lịch sử thay vì chỉ hiện câu trả lời
 * cuối, để giám đốc thấy được mình đã hỏi gì và hệ thống đã mở gì — giống một
 * đoạn hội thoại tin nhắn thoại, không phải một ô kết quả chớp tắt.
 */
type ThreadEntry =
  | { kind: "voice"; id: string; text: string; durationMs: number; at: number }
  | { kind: "typed"; id: string; text: string; at: number }
  | {
      kind: "reply";
      id: string;
      at: number;
      answer: string;
      detail: string;
      href?: string;
      hrefLabel?: string;
    };

const THREAD_STORAGE_KEY = "erp-assistant-thread";
const THREAD_MAX_ENTRIES = 24;

// Dựng lượt hội thoại ở phạm vi module, không phải trong thân component: đọc
// đồng hồ và sinh mã ngẫu nhiên là việc của trình xử lý sự kiện, không được
// nằm trên đường render.
function nextEntryId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSpokenEntry(text: string, durationMs: number): ThreadEntry {
  return { kind: "voice", id: nextEntryId("voice"), text, durationMs, at: Date.now() };
}

function createTypedEntry(text: string): ThreadEntry {
  return { kind: "typed", id: nextEntryId("typed"), text, at: Date.now() };
}

function createReplyEntry(reply: CommandResult): ThreadEntry {
  return { kind: "reply", id: nextEntryId("reply"), at: Date.now(), ...reply };
}

type RecognitionConstructor = new () => RecognitionInstance;

type Props = {
  role: ErpRole;
  siteIds: ErpSiteId[];
  currentSiteId?: ErpSiteId;
};

type CommandResult = {
  answer: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

type ModuleCommand = {
  id: ErpModuleId;
  terms: string[];
};

const siteAliases: Array<{ id: ErpSiteId; terms: string[] }> = [
  { id: "trang-an", terms: ["trang an"] },
  { id: "tam-chuc", terms: ["tam chuc"] },
  { id: "tam-coc", terms: ["tam coc"] },
  { id: "bai-dinh", terms: ["bai dinh"] },
];

const moduleCommands: ModuleCommand[] = [
  { id: "bao-cao-hien-truong", terms: ["bao cao hien truong", "anh hien truong", "bao cao anh", "hinh anh hien truong", "nop anh"] },
  { id: "camera-ai", terms: ["camera ai", "camera", "cam", "hien truong", "giam sat"] },
  { id: "tai-chinh-doi-soat", terms: ["tai chinh", "doanh thu", "loi nhuan", "chi phi", "doi soat", "cong no", "phai tra", "but toan", "chung tu ke toan", "hoa don dien tu", "dong ky"] },
  { id: "check-in-khach", terms: ["check in khach", "checkin khach", "quet ma", "xac thuc ve"] },
  { id: "cham-cong", terms: ["cham cong", "vao ca", "ra ca", "bang cong"] },
  { id: "suc-chua", terms: ["suc chua", "luong khach", "qua tai", "mat do khach"] },
  { id: "su-co", terms: ["su co", "canh bao", "dieu phoi su co", "an toan"] },
  { id: "nhan-su", terms: ["nhan su", "nhan vien", "ca truc", "xep ca", "phan cong nhan vien"] },
  { id: "xe-trung-chuyen", terms: ["xe trung chuyen", "xe dien", "tai xe", "lich xe"] },
  { id: "tai-san-bao-tri", terms: ["tai san", "bao tri", "nghiem thu", "bao duong"] },
  { id: "doi-tac-nha-cung-ung", terms: ["doi tac", "nha cung ung", "nha thau", "hoa don dau vao", "ho so nha cung cap"] },
  { id: "sop-dien-tap", terms: ["sop", "dien tap", "quy trinh", "go no go"] },
  { id: "du-an-su-kien", terms: ["du an", "su kien", "festival", "le hoi", "chuong trinh lon", "tien do su kien"] },
  { id: "bao-cao", terms: ["bao cao", "phan tich", "du bao", "thang quy nam"] },
  { id: "ve-dat-cho", terms: ["ve dat cho", "ban ve", "dat cho", "booking"] },
];

const suggestionsByRole: Record<ErpRole, string[]> = {
  director: [
    "Hôm nay doanh thu bao nhiêu?",
    "Công nợ nhà cung cấp đã ghi nhận bao nhiêu?",
    "Mở báo cáo hiện trường Tràng An",
    "Mở tài chính tổng hợp",
    "Mở camera Tam Chúc",
    "Mở sức chứa Tam Chúc",
    "Mở sự cố Tràng An",
    "Mở nhân sự Bái Đính",
    "Mở xe trung chuyển Tam Chúc",
    "Mở tài sản Tràng An",
    "Mở SOP Tam Cốc",
    "Mở dự án lễ hội Tràng An",
    "Mở báo cáo dự báo",
    "Cơ sở nào đang quá tải?",
  ],
  manager: [
    "Mở hóa đơn nhà cung cấp",
    "Mở báo cáo hiện trường",
    "Mở camera hiện trường",
    "Mở sức chứa",
    "Mở sự cố",
    "Mở nhân sự và ca trực",
    "Mở check-in khách",
    "Mở xe trung chuyển",
    "Mở tài sản bảo trì",
    "Mở SOP diễn tập",
    "Mở dự án sự kiện",
    "Mở tài chính đối soát",
  ],
  accountant: [
    "Mở đối soát toàn vùng",
    "Mở công nợ nhà cung cấp",
    "Hóa đơn nào cần tôi xử lý?",
    "Mở hóa đơn điện tử",
    "Mở chứng từ kế toán",
    "Mở đóng kỳ tháng 7",
    "Mở tài sản Tam Chúc",
    "Mở báo cáo hiện trường Tràng An",
    "Mở dự án sự kiện Bái Đính",
  ],
  "chief-accountant": [
    "Mở bút toán chờ kiểm tra",
    "Mở đối soát toàn vùng",
    "Mở công nợ nhà cung cấp",
    "Hóa đơn nhà cung cấp nào chờ kiểm tra?",
    "Mở đóng kỳ tháng 7",
    "Mở báo cáo tài chính",
  ],
  employee: [
    "Nộp ảnh hiện trường",
    "Mở chấm công",
    "Mở check-in khách",
    "Mở sự cố",
    "Mở sức chứa",
    "Mở xe trung chuyển",
    "Mở tài sản bảo trì",
    "Mở SOP",
  ],
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(command: string, term: string) {
  return ` ${command} `.includes(` ${term} `);
}

function findSite(command: string, allowedSiteIds: readonly ErpSiteId[]) {
  return siteAliases.find(
    (site) => allowedSiteIds.includes(site.id) && site.terms.some((term) => containsTerm(command, term)),
  )?.id;
}

function findModule(command: string) {
  return moduleCommands.find((module) => module.terms.some((term) => containsTerm(command, term)));
}

function isSupplierApCommand(command: string) {
  return /(cong no nha cung cap|phai tra nha cung cap|bao cao cong no|hoa don nha cung cap|hoa don dau vao)/.test(
    command,
  );
}

function findCameraId(command: string) {
  const numbered = command.match(/\b(?:camera|cam)\s*(?:so)?\s*([1-4])\b/)?.[1];
  if (numbered) return numbered.padStart(2, "0");
  const zoneAliases: Array<[string, string[]]> = [
    ["01", ["cong a", "cong chinh", "cong ve", "cong khach dien"]],
    ["02", ["ben thuyen", "ben do", "ben xe dien"]],
    ["03", ["vung cho", "dien tam the", "hanh lang la han"]],
    ["04", ["tuyen thuyen", "tuyen song", "doc thap ngoc", "bao thap"]],
  ];
  return zoneAliases.find(([, aliases]) => aliases.some((alias) => containsTerm(command, alias)))?.[0];
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Tên màn hình đọc được cho con người, dùng trong dòng "Đã mở …". */
function describeDestination(href: string) {
  const [path] = href.split("#");
  const segments = path.split("/").filter(Boolean);
  if (path === "/erp") return "Tổng quan điều hành";
  if (segments[1] === "finance") return "Tài chính tổng hợp";
  const site = ERP_SITES.find((item) => item.id === segments[1]);
  const moduleName = ERP_MODULES.find((item) => item.id === segments[2])?.name;
  if (site && moduleName) return `${moduleName} · ${site.shortName}`;
  if (site) return `Tổng quan ${site.shortName}`;
  return "màn hình được yêu cầu";
}

export function resolveErpNavigationCommand(rawCommand: string, role: ErpRole, siteIds: readonly ErpSiteId[], currentSiteId?: ErpSiteId) {
  const command = normalize(rawCommand);
  const namedSite = findSite(command, siteIds);
  const targetSite = namedSite ?? currentSiteId ?? siteIds[0];
  const matchedModule = findModule(command);
  const asksToOpen = /\b(mo|xem|den|vao|chuyen|truy cap)\b/.test(command) || containsTerm(command, "di toi");
  const isQuestion = /(bao nhieu|the nao|vi sao|tai sao|co gi|hom nay|hien tai|bay gio|o dau)/.test(command);
  const isShortModuleCommand = Boolean(matchedModule) && command.split(" ").length <= 5 && !isQuestion;

  if (asksToOpen && /(trang chu|tong quan|dashboard|man hinh chinh)/.test(command)) return "/erp";
  if (asksToOpen && isSupplierApCommand(command)) {
    if (role === "employee") return null;
    if (role === "manager") {
      return targetSite
        ? `/erp/${targetSite}/doi-tac-nha-cung-ung`
        : "/erp";
    }
    return namedSite
      ? `/erp/${namedSite}/doi-tac-nha-cung-ung`
      : "/erp/finance#supplier-payables";
  }
  if (matchedModule && targetSite && (asksToOpen || isShortModuleCommand)) {
    if ((role === "accountant" || role === "chief-accountant") && !ERP_ACCOUNTANT_MODULE_IDS.includes(matchedModule.id)) return null;
    if ((role === "director" || role === "accountant" || role === "chief-accountant") && !namedSite && !currentSiteId && matchedModule.id === "tai-chinh-doi-soat") return "/erp/finance";
    if (role === "director" && !namedSite && !currentSiteId && matchedModule.id === "bao-cao") return "/erp/finance#forecast";
    const cameraId = matchedModule.id === "camera-ai" ? findCameraId(command) : undefined;
    return `/erp/${targetSite}/${matchedModule.id}${cameraId ? `?camera=${cameraId}` : ""}`;
  }
  if (asksToOpen && namedSite) return `/erp/${namedSite}`;
  return null;
}

export function VoiceCommandCenter({ role, siteIds, currentSiteId }: Props) {
  const router = useRouter();
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const heardSpeechRef = useRef(false);
  const startedAtRef = useRef(0);
  const durationTimerRef = useRef<number | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recordingMs, setRecordingMs] = useState(0);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState("");

  function pushEntry(entry: ThreadEntry) {
    setThread((previous) => [...previous, entry].slice(-THREAD_MAX_ENTRIES));
  }

  function pushReply(reply: CommandResult) {
    pushEntry(createReplyEntry(reply));
  }

  // Luồng hội thoại sống trong sessionStorage: đóng trợ lý rồi mở lại, hoặc
  // chuyển sang màn hình vừa được mở, vẫn thấy lại mình đã nói gì. Đóng tab thì
  // hết -- đây là ngữ cảnh thao tác, không phải nhật ký, và nhật ký thật nằm ở
  // chỗ khác.
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(THREAD_STORAGE_KEY);
      // Không đọc được ở lượt khởi tạo state: máy chủ không có sessionStorage,
      // đọc sớm hơn effect là lệch HTML giữa máy chủ và client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setThread(JSON.parse(stored) as ThreadEntry[]);
    } catch {
      // Trình duyệt chặn sessionStorage thì trợ lý vẫn phải dùng được.
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(thread));
    } catch {
      // Như trên.
    }
  }, [thread]);

  useEffect(() => {
    if (!open) return;
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [open, thread, interim]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function navigate(href: string) {
    recognitionRef.current?.stop();
    setListening(false);
    setOpen(false);
    router.push(href);
  }

  async function queryLiveSnapshot(
    intent:
      | "revenue"
      | "cost"
      | "profit"
      | "guests"
      | "supplier-payables"
      | "urgent",
  ) {
    setVoiceMessage("Đang đọc số liệu mới nhất…");
    try {
      const response = await fetch("/api/erp/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const payload = (await response.json()) as CommandResult & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Không đọc được số liệu.");
      }
      pushReply({
        answer: payload.answer,
        detail: payload.detail,
        href: payload.href,
        hrefLabel: payload.hrefLabel,
      });
      setVoiceMessage("Đã đọc xong số liệu trong phạm vi tài khoản.");
    } catch (error) {
      pushReply({
        answer: "Chưa đọc được số liệu lúc này",
        detail:
          error instanceof Error
            ? error.message
            : "Kho dữ liệu chưa phản hồi.",
      });
      setVoiceMessage("Truy vấn chưa hoàn tất.");
    }
  }

  async function execute(rawCommand: string, spoken?: { durationMs: number }) {
    const command = normalize(rawCommand);
    const namedSite = findSite(command, siteIds);
    const targetSite = namedSite ?? currentSiteId ?? siteIds[0];
    const matchedModule = findModule(command);

    setTranscript(rawCommand);
    setInterim("");
    pushEntry(
      spoken ? createSpokenEntry(rawCommand, spoken.durationMs) : createTypedEntry(rawCommand),
    );

    const navigationHref = resolveErpNavigationCommand(rawCommand, role, siteIds, currentSiteId);
    if (navigationHref) {
      // Ghi lại đã mở màn hình nào trước khi chuyển trang, để mở lại trợ lý là
      // thấy ngay lịch sử chứ không phải một ô trống.
      pushReply({
        answer: `Đã mở ${describeDestination(navigationHref)}`,
        detail: "Nhận ra từ khoá trong câu và chuyển thẳng tới màn hình tương ứng.",
      });
      navigate(navigationHref);
      return;
    }

    if ((role === "accountant" || role === "chief-accountant") && matchedModule && !ERP_ACCOUNTANT_MODULE_IDS.includes(matchedModule.id)) {
      pushReply({
        answer: "Nghiệp vụ này không thuộc quyền kế toán",
        detail: "Tài khoản kế toán chỉ được mở hồ sơ nguồn và các nghiệp vụ tài chính đã phân quyền.",
        href: "/erp/finance",
        hrefLabel: "Mở hàng việc kế toán",
      });
      return;
    }

    if (/(doanh thu|ban duoc|thu duoc)/.test(command) && /(hom nay|hien tai|bay gio|bao nhieu)/.test(command)) {
      await queryLiveSnapshot("revenue");
      return;
    }

    if (
      isSupplierApCommand(command) ||
      /(hoa don nao|hoa don can|hoa don cho)/.test(command)
    ) {
      await queryLiveSnapshot("supplier-payables");
      return;
    }

    if (/(chi phi|phai tra|cong no|chi tra)/.test(command)) {
      await queryLiveSnapshot("cost");
      return;
    }

    if (/(loi nhuan|lai bao nhieu|bien loi nhuan)/.test(command)) {
      await queryLiveSnapshot("profit");
      return;
    }

    if (/(bao nhieu khach|khach hom nay|khach da check in|khach da vao)/.test(command)) {
      await queryLiveSnapshot("guests");
      return;
    }

    if (/(can xu ly gap|viec gap|co gi gap|uu tien ngay|khan cap)/.test(command)) {
      await queryLiveSnapshot("urgent");
      return;
    }

    if (/(qua tai|dong nhat|can chu y|suc chua)/.test(command)) {
      pushReply({
        answer: "Mở màn hình sức chứa để xem theo cơ sở",
        detail: "Trợ lý chưa nhận được luồng đếm người thời gian thực nên không tự đưa ra một tỷ lệ tải.",
        href: targetSite ? `/erp/${targetSite}/suc-chua` : undefined,
        hrefLabel: "Mở sức chứa",
      });
      return;
    }

    if (/(su co|canh bao)/.test(command)) {
      pushReply({
        answer: "Mở danh sách sự cố của cơ sở",
        detail: "Trợ lý chỉ báo số khi sự cố đã được ghi vào nguồn dữ liệu vận hành.",
        href: targetSite ? `/erp/${targetSite}/su-co` : undefined,
        hrefLabel: "Mở danh sách sự cố",
      });
      return;
    }

    if (/(du bao|30 ngay|thang toi|sap toi)/.test(command)) {
      pushReply({
        answer: "Chưa đủ chuỗi dữ liệu để dự báo 30 ngày",
        detail: "Cần dữ liệu đặt chỗ, công suất và lịch sự kiện đã được ghi nhận trước khi đưa ra dự báo.",
        href: role === "director" ? "/erp/finance#forecast" : undefined,
        hrefLabel: "Mở dự báo",
      });
      return;
    }

    pushReply({
      answer: "Chưa tìm thấy màn hình phù hợp",
      detail: "Hãy nói “Mở” kèm nghiệp vụ và cơ sở, ví dụ: “Mở camera Tam Chúc” hoặc “Mở nhân sự Tràng An”.",
    });
  }

  function stopDurationTimer() {
    if (durationTimerRef.current !== null) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }

  function startListening() {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      setVoiceMessage("Máy này chưa hỗ trợ nhận giọng nói. Bạn có thể nhập lệnh ngay bên dưới.");
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
      return;
    }
    setSpeechSupported(true);
    setVoiceMessage("Đang xin quyền sử dụng micro…");
    heardSpeechRef.current = false;
    setInterim("");
    const recognition = new Recognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    // Bật kết quả tạm: chữ hiện dần ngay khi đang nói, thay vì im lặng rồi
    // nhảy ra cả câu. Đây là phần "tự chuyển ra text" nhìn thấy được.
    recognition.interimResults = true;
    recognition.onstart = () => {
      setListening(true);
      startedAtRef.current = Date.now();
      setRecordingMs(0);
      durationTimerRef.current = window.setInterval(() => {
        setRecordingMs(Date.now() - startedAtRef.current);
      }, 100);
      setVoiceMessage("Đang nghe. Hãy nói tên màn hình và cơ sở.");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let pendingText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const alternative = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) finalText += alternative;
        else pendingText += alternative;
      }
      if (pendingText) setInterim(pendingText);
      if (finalText.trim()) {
        heardSpeechRef.current = true;
        stopDurationTimer();
        setVoiceMessage(`Đã chuyển thành văn bản: “${finalText.trim()}”`);
        execute(finalText.trim(), {
          durationMs: Math.max(1, Date.now() - startedAtRef.current),
        });
      }
    };
    recognition.onend = () => {
      setListening(false);
      stopDurationTimer();
      setInterim("");
      if (!heardSpeechRef.current) setVoiceMessage("Chưa nghe rõ. Chạm micro để thử lại hoặc nhập lệnh bên dưới.");
    };
    recognition.onerror = (event) => {
      setListening(false);
      stopDurationTimer();
      setInterim("");
      const messages: Record<string, string> = {
        "not-allowed": "Micro đang bị chặn. Hãy cho phép quyền micro trong cài đặt trình duyệt.",
        "audio-capture": "Không tìm thấy micro trên thiết bị.",
        network: "Kết nối nhận giọng nói bị gián đoạn. Hãy thử lại hoặc nhập lệnh.",
        "no-speech": "Chưa nghe thấy giọng nói. Hãy đưa điện thoại gần hơn và thử lại.",
      };
      setVoiceMessage(messages[event.error] ?? "Không thể nhận giọng nói. Hãy thử lại hoặc nhập lệnh.");
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceMessage("Micro chưa sẵn sàng. Hãy thử lại hoặc nhập lệnh.");
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
    }
  }

  function closeDialog() {
    recognitionRef.current?.stop();
    stopDurationTimer();
    setListening(false);
    setInterim("");
    setOpen(false);
  }

  useEffect(() => stopDurationTimer, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở trợ lý điều hành"
        className="fixed bottom-4 right-4 z-[1000] flex min-h-14 items-center gap-2 rounded-full border border-white/70 bg-[#183f34] p-1.5 pr-1.5 text-white shadow-2xl shadow-[#173f34]/30 transition hover:-translate-y-0.5 sm:bottom-5 sm:right-5 sm:pr-4"
      >
        <Image src="/brand/ninh-binh-mark.png" alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
        <span className="hidden text-sm font-black sm:block">Trợ lý điều hành</span>
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="pointer-events-none fixed inset-0 z-[1100]">
          <button type="button" aria-label="Đóng trợ lý" onClick={closeDialog} className="pointer-events-auto absolute inset-0 bg-[#071b15]/12 backdrop-blur-[1px]" />
          <section role="dialog" aria-modal="true" aria-labelledby="voice-title" className="pointer-events-auto absolute inset-x-3 bottom-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-[#d5ddd8] bg-[#f5f7f4] p-4 shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[25rem] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image src="/brand/ninh-binh-mark.png" alt="" width={42} height={42} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                <div className="min-w-0"><p className="text-xs font-bold text-[#477565]">TRỢ LÝ ĐIỀU HÀNH</p><h2 id="voice-title" className="truncate text-lg font-black text-[#20342c]">Bạn cần mở màn hình nào?</h2></div>
              </div>
              <button type="button" onClick={closeDialog} aria-label="Đóng" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d4ddd7] bg-white text-xl text-[#42554c]">×</button>
            </div>

            <div
              aria-live="polite"
              data-testid="assistant-thread"
              className="mt-4 max-h-[38dvh] space-y-2.5 overflow-y-auto sm:max-h-72"
            >
              {thread.length === 0 && !interim ? (
                <p className="rounded-2xl bg-white/70 p-3 text-xs leading-5 text-[#69786f]">
                  Giữ micro và nói bình thường. Hệ thống chuyển giọng nói thành văn bản
                  ngay khi bạn đang nói, nghe ra từ khoá rồi mở thẳng màn hình tương ứng.
                </p>
              ) : null}

              {thread.map((entry) =>
                entry.kind === "reply" ? (
                  <article
                    key={entry.id}
                    className="mr-6 rounded-2xl rounded-tl-md bg-[#183f34] p-3.5 text-white"
                  >
                    <p className="text-sm font-black leading-5">{entry.answer}</p>
                    <p className="mt-1.5 text-xs leading-5 text-white/68">{entry.detail}</p>
                    {entry.href ? (
                      <button
                        type="button"
                        onClick={() => navigate(entry.href!)}
                        className="mt-2.5 min-h-10 w-full rounded-xl bg-white px-4 text-sm font-black text-[#183f34]"
                      >
                        {entry.hrefLabel}
                      </button>
                    ) : null}
                  </article>
                ) : (
                  <div
                    key={entry.id}
                    className="ml-6 rounded-2xl rounded-tr-md border border-[#cfdcd5] bg-white p-3"
                  >
                    {entry.kind === "voice" ? (
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6f8d7f]">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
                        Tin nhắn thoại · {formatDuration(entry.durationMs)}
                      </p>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9a92]">
                        Lệnh nhập
                      </p>
                    )}
                    <p className="mt-1.5 text-sm leading-5 text-[#2c4237]">{entry.text}</p>
                  </div>
                ),
              )}

              {interim ? (
                <div className="ml-6 rounded-2xl rounded-tr-md border border-dashed border-[#c0d2c8] bg-[#f0f6f2] p-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6f8d7f]">
                    {/* Sóng âm: cao thấp và lệch pha khác nhau cho ra nhịp nói. */}
                    <span className="flex h-3.5 items-end gap-0.5" aria-hidden="true">
                      {[
                        [0, 6],
                        [120, 12],
                        [240, 9],
                        [80, 14],
                      ].map(([delay, height]) => (
                        <span
                          key={delay}
                          style={{ animationDelay: `${delay}ms`, height: `${height}px` }}
                          className="block w-0.5 animate-pulse rounded-full bg-[#4f806f] motion-reduce:animate-none"
                        />
                      ))}
                    </span>
                    Đang chuyển thành văn bản · {formatDuration(recordingMs)}
                  </p>
                  <p className="mt-1.5 text-sm leading-5 text-[#4c6155]">{interim}</p>
                </div>
              ) : null}
              <div ref={threadEndRef} />
            </div>

            <button type="button" onClick={startListening} disabled={listening} className={`mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border px-4 transition ${listening ? "border-[#d27460] bg-[#fff0ec] text-[#8f3f32]" : "border-[#b9ccc3] bg-white text-[#183f34] hover:border-[#6d9686]"}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-full ${listening ? "animate-pulse bg-[#d45f49] text-white motion-reduce:animate-none" : "bg-[#e3eee9]"}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg>
              </span>
              <span className="text-left"><strong className="block text-sm">{listening ? `Đang nghe… ${formatDuration(recordingMs)}` : "Nói để mở nhanh"}</strong><span className="mt-0.5 block text-xs opacity-65">“Mở camera Tam Chúc”</span></span>
            </button>

            {voiceMessage ? <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-xs ${speechSupported ? "bg-[#e6f0eb] text-[#315e4d]" : "bg-[#fff0dc] text-[#76501d]"}`}>{voiceMessage}</p> : null}

            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const value = String(data.get("command") ?? "").trim(); if (value) execute(value); }}>
              <input ref={commandInputRef} name="command" value={transcript} onChange={(event) => setTranscript(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm outline-none focus:border-[#4f806f]" placeholder="Ví dụ: Mở tài chính tổng hợp" />
              <button type="submit" aria-label="Gửi lệnh" className="grid min-h-11 w-11 place-items-center rounded-xl bg-[#183f34] text-white">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
              </button>
            </form>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#718078]">Lệnh nhanh</p>
                {thread.length ? (
                  <button type="button" onClick={() => setThread([])} className="text-[11px] font-bold text-[#7d8c84] underline underline-offset-2">
                    Xoá hội thoại
                  </button>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {suggestionsByRole[role].map((suggestion) => <button key={suggestion} type="button" onClick={() => execute(suggestion)} className="min-h-10 rounded-xl border border-[#d5ded8] bg-white px-3 py-2 text-left text-xs font-bold leading-4 text-[#53675e] transition hover:border-[#8ba99c]">{suggestion}</button>)}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
