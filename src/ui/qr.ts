import qrcode from 'qrcode-generator';

/**
 * QR module matrix for `text`, encoded at error-correction level **H** (~30% recovery) so a small
 * centre logo can sit on the code without breaking scans. Returns a square `size × size` grid of
 * booleans (`true` = a dark module). Pure — no DOM — so it renders identically in tests and SSR.
 *
 * `typeNumber` 0 lets the encoder pick the smallest version that fits the text.
 */
export function duelQrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}
