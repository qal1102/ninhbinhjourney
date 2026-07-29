import type { IncidentDraft } from "@/domain/models";

export const REQUIRED_INCIDENT_SAMPLE =
  "Bến thuyền Tràng An đang đông, thời gian chờ khoảng 20 phút, cần thêm 3 nhân sự hỗ trợ phân luồng.";

const siteIds = {
  "trang-an": "10000000-0000-4000-8000-000000000001",
} as const;

const sopIds = {
  "crowd-capacity": "50000000-0000-4000-8000-000000000001",
  weather: "50000000-0000-4000-8000-000000000002",
  "water-safety": "50000000-0000-4000-8000-000000000003",
  medical: "50000000-0000-4000-8000-000000000004",
  "lost-person": "50000000-0000-4000-8000-000000000005",
} as const;

function normalizedText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN");
}

export function parseIncidentDraft(input: {
  id: string;
  demoRunId: string;
  text: string;
}): IncidentDraft {
  const transcript = input.text.trim();
  const text = normalizedText(transcript);
  const draft: IncidentDraft = {
    id: input.id,
    demoRunId: input.demoRunId,
    transcript,
    fieldConfidence: {},
    humanConfirmationRequired: true,
  };

  if (/\btrang an\b/.test(text)) {
    draft.siteId = siteIds["trang-an"];
    draft.fieldConfidence.siteId = 0.99;
  }
  if (/\bdong\b|\bqua tai\b|\bxep hang\b|\bphan luong\b/.test(text)) {
    draft.category = "crowd-capacity";
    draft.sopId = sopIds["crowd-capacity"];
    draft.suggestedSeverity = "P3";
    draft.fieldConfidence.category = 0.96;
    draft.fieldConfidence.suggestedSeverity = 0.72;
  } else if (/\bmua lon\b|\bgio manh\b|\bthoi tiet\b/.test(text)) {
    draft.category = "weather";
    draft.sopId = sopIds.weather;
    draft.suggestedSeverity = "P2";
    draft.fieldConfidence.category = 0.9;
  } else if (/\bduoi nuoc\b|\bcuu ho\b|\btren nuoc\b/.test(text)) {
    draft.category = "water-safety";
    draft.sopId = sopIds["water-safety"];
    draft.suggestedSeverity = "P1";
    draft.fieldConfidence.category = 0.92;
  } else if (/\by te\b|\bngat\b|\bchan thuong\b/.test(text)) {
    draft.category = "medical";
    draft.sopId = sopIds.medical;
    draft.suggestedSeverity = "P2";
    draft.fieldConfidence.category = 0.85;
  } else if (/\bdi lac\b|\bthat lac\b/.test(text)) {
    draft.category = "lost-person";
    draft.sopId = sopIds["lost-person"];
    draft.suggestedSeverity = "P2";
    draft.fieldConfidence.category = 0.92;
  }

  const waitTime = text.match(
    /(?:cho|doi|wait)[^\d]{0,20}(\d{1,3})\s*(?:phut|minutes?)/,
  );
  if (waitTime) {
    draft.waitTimeMinutes = Number(waitTime[1]);
    draft.fieldConfidence.waitTimeMinutes = 0.94;
  }
  const staff = text.match(
    /(?:them|can|need)[^\d]{0,16}(\d{1,3})\s*(?:nhan su|nguoi|staff)/,
  );
  if (staff) {
    draft.resourceRequest = {
      resourceType: "queue-support-staff",
      quantity: Number(staff[1]),
    };
    draft.fieldConfidence.resourceRequest = 0.9;
  }

  return draft;
}
