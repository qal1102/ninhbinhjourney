import type { ShiftCloseRecord } from "@/domain/erp-shift-close";

export type ShiftCloseActionState = {
  status: "idle" | "success" | "error";
  message: string;
  recordId?: string;
  record?: ShiftCloseRecord;
};

export const INITIAL_SHIFT_CLOSE_ACTION_STATE: ShiftCloseActionState = {
  status: "idle",
  message: "",
};
