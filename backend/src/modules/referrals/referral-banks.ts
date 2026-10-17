/** Ngân hàng hỗ trợ nhận hoa hồng: `bin` là mã NAPAS dùng dựng QR VietQR (img.vietqr.io/image/<bin>-<stk>-compact2.png). */
export interface BankInfo {
  bin: string;
  short: string;
  name: string;
}

export const BANKS: readonly BankInfo[] = [
  { bin: '970436', short: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bin: '970415', short: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970418', short: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970405', short: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' },
  { bin: '970422', short: 'MB Bank', name: 'Ngân hàng TMCP Quân đội' },
  { bin: '970407', short: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970416', short: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', short: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970423', short: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
  { bin: '970403', short: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970437', short: 'HDBank', name: 'Ngân hàng TMCP Phát triển TP.HCM' },
  { bin: '970441', short: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970443', short: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
  { bin: '970448', short: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970426', short: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
  { bin: '970431', short: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
  { bin: '970429', short: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
  { bin: '970425', short: 'ABBank', name: 'Ngân hàng TMCP An Bình' },
  { bin: '970409', short: 'BacABank', name: 'Ngân hàng TMCP Bắc Á' },
  { bin: '970428', short: 'Nam A Bank', name: 'Ngân hàng TMCP Nam Á' },
  { bin: '970419', short: 'NCB', name: 'Ngân hàng TMCP Quốc Dân' },
  { bin: '970449', short: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
  { bin: '970440', short: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
  { bin: '970412', short: 'PVcomBank', name: 'Ngân hàng TMCP Đại chúng Việt Nam' },
  { bin: '970433', short: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
  { bin: '970438', short: 'BaoViet Bank', name: 'Ngân hàng TMCP Bảo Việt' },
  { bin: '970452', short: 'KienlongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { bin: '546034', short: 'CAKE', name: 'Ngân hàng số CAKE by VPBank' },
  { bin: '963388', short: 'Timo', name: 'Ngân hàng số Timo' },
];

export const bankByBin = (bin: string): BankInfo | undefined => BANKS.find((b) => b.bin === bin);
