import "server-only";

import webpush from "web-push";
import type { BaoDong } from "@/domain/khan-cap";
import { tenLoaiKhanCap } from "@/domain/khan-cap";
import { dangKyCuaTaiKhoan, xoaDangKyDay } from "@/lib/erp/khan-cap-repository";

/**
 * Thông báo đẩy (Web Push) cho báo khẩn cấp: tới được máy cấp trên cả khi app
 * ERP đang đóng. Cần ba biến môi trường phía máy chủ: `VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (dạng `mailto:` hay `https:`). Thiếu
 * thì không gửi, và cảnh báo trong app (hỏi kho mỗi vài giây) vẫn chạy.
 */

export function khoaCongKhaiDay(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function cauHinh(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "https://ninhbinhjourney.vercel.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

/** Gửi tới mọi máy đã đăng ký của các cấp trên. Trả số máy nhận được. */
export async function dayBaoDong(bd: BaoDong, nhacLai = false): Promise<number> {
  if (!cauHinh()) return 0;
  const nguoiNhan = bd.capTren.map((c) => c.accountId).filter((id) => id !== bd.nguoiBaoAccountId);
  const ds = await dangKyCuaTaiKhoan(nguoiNhan);
  const noiDung = JSON.stringify({
    title: `${nhacLai ? "NHẮC LẠI · " : ""}BÁO KHẨN CẤP · ${bd.siteName}`,
    body: `${tenLoaiKhanCap(bd.loai)}. ${bd.nguoiBaoTen} báo${bd.ghiChu ? `: ${bd.ghiChu}` : "."} Bấm để nhận.`,
    url: `/erp?khanCap=${bd.ma}`,
    tag: `khan-cap-${bd.ma}`,
    khanCap: true,
  });
  let dat = 0;
  await Promise.all(
    ds.map(async (dk) => {
      try {
        await webpush.sendNotification(
          { endpoint: dk.endpoint, keys: { p256dh: dk.p256dh, auth: dk.auth } },
          noiDung,
          { TTL: 600, urgency: "high", topic: `kc${bd.ma.replace(/[^A-Za-z0-9]/g, "")}` },
        );
        dat += 1;
      } catch (error) {
        // Máy đã gỡ app hay thu hồi quyền: bỏ đăng ký cũ.
        const ma = (error as { statusCode?: number }).statusCode;
        if (ma === 404 || ma === 410) await xoaDangKyDay(dk.endpoint).catch(() => undefined);
      }
    }),
  );
  return dat;
}
