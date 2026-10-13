/**
 * Chia sẻ bằng hộp chia sẻ của điện thoại (Zalo, Messenger…); máy không có
 * thì chép vào bộ nhớ tạm. Trả `"da-chep"` khi đã chép để nút đổi chữ.
 */
export async function chiaSe(url: string, loi: string): Promise<"da-gui" | "da-chep" | "huy"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Ninh Bình Journey", text: loi, url });
      return "da-gui";
    }
    await navigator.clipboard.writeText(`${loi} ${url}`);
    return "da-chep";
  } catch {
    return "huy";
  }
}
