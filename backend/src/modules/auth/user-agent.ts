export type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface ParsedUserAgent {
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  kind: DeviceKind;
}

/** Phân tích User-Agent đủ dùng để hiển thị "Chrome • macOS" ở danh sách thiết bị (không phải parser đầy đủ). */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { browser: 'Trình duyệt', os: 'Thiết bị không xác định', kind: 'unknown' };

  let browser = 'Trình duyệt';
  let browserVersion: string | undefined;
  // Thứ tự quan trọng: Edge/Opera/Samsung đều chứa "Chrome", Chrome chứa "Safari".
  const RULES: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
  ];
  for (const [re, name] of RULES) {
    const hit = re.exec(ua);
    if (hit) {
      browser = name;
      browserVersion = hit[1];
      break;
    }
  }
  if (browser === 'Trình duyệt' && /Safari\//.test(ua)) browser = 'Safari';

  let os = 'Không rõ';
  let osVersion: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = /Android ([\d.]+)/.exec(ua))) [os, osVersion] = ['Android', m[1]];
  else if ((m = /(?:iPhone|CPU) OS ([\d_]+)/.exec(ua)) && /iPhone|iPad|iPod/.test(ua)) [os, osVersion] = ['iOS', m[1]!.replace(/_/g, '.')];
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) [os, osVersion] = ['macOS', m[1]!.replace(/_/g, '.')];
  else if (/Mac OS/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux|X11/.test(ua)) os = 'Linux';

  let kind: DeviceKind = 'desktop';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) kind = 'tablet';
  else if (/iPhone|iPod|Android|Mobile/.test(ua)) kind = 'mobile';
  else if (os === 'Không rõ' && browser === 'Trình duyệt') kind = 'unknown';

  return { browser, browserVersion, os, osVersion, kind };
}
