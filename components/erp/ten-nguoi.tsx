"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

/**
 * Đổi mã tài khoản ("chief-accountant-001") ra họ tên người ("Nguyễn Hải
 * Yến") ở các màn tài chính. Sổ chỉ lưu mã, vì tên người có thể đổi mà dấu vết
 * thì không được đổi; còn người đọc sổ thì cần tên. Trang máy chủ đọc danh bạ
 * nhân sự rồi đưa xuống qua `TenNguoiProvider`; mã nào không có trong danh bạ
 * thì giữ nguyên mã, không đoán.
 */

const TenNguoiContext = createContext<Readonly<Record<string, string>>>({});

export function TenNguoiProvider({ ten, children }: { ten: Readonly<Record<string, string>>; children: ReactNode }) {
  return <TenNguoiContext.Provider value={ten}>{children}</TenNguoiContext.Provider>;
}

export function useTenNguoi() {
  const ten = useContext(TenNguoiContext);
  return useCallback((maTaiKhoan: string | null | undefined) => (maTaiKhoan ? (ten[maTaiKhoan] ?? maTaiKhoan) : null), [ten]);
}
