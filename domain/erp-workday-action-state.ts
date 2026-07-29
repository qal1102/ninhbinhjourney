import type {
  WorkdayLocationEvent,
  WorkdayRecord,
} from "@/domain/erp-workday";

export type WorkdayActionResult =
  | {
      success: true;
      message: string;
      record?: WorkdayRecord;
      location?: WorkdayLocationEvent;
    }
  | {
      success: false;
      message: string;
    };
