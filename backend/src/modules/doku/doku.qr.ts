import QRCode from "qrcode";

/**
 * Render string EMVCo QRIS dinamis menjadi PNG.
 * Dipakai endpoint `GET /payments/:id/qr` agar klien (web/Android)
 * tidak butuh pustaka QR sendiri. Tanpa DB — murni fungsi render.
 */
export const renderQrPng = async (qrString: string, width = 512): Promise<Buffer> => {
  const payload = qrString.trim();
  if (!payload) throw new Error("String QR kosong");
  return QRCode.toBuffer(payload, {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
};
