/** Âm báo ngắn cho trắc nghiệm, tổng hợp bằng Web Audio (không cần tệp âm thanh). Chỉ phát sau thao tác của người dùng. */
type Note = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

let ctx: AudioContext | null = null;

function play(notes: Note[]) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.freq;
      const peak = n.gain ?? 0.18;
      g.gain.setValueAtTime(0.0001, t0 + n.start);
      g.gain.exponentialRampToValueAtTime(peak, t0 + n.start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + n.start);
      osc.stop(t0 + n.start + n.dur + 0.02);
    }
  } catch {
    // Âm thanh chỉ là điểm nhấn: trình duyệt chặn/không hỗ trợ thì bỏ qua, không ảnh hưởng làm bài.
  }
}

/** Đúng: hai nốt đi lên vui tai. */
export const playCorrect = () =>
  play([
    { freq: 659.25, start: 0, dur: 0.14 },
    { freq: 987.77, start: 0.1, dur: 0.26 },
  ]);

/** Sai: hai nốt trầm đi xuống, nhẹ nhàng (không gắt). */
export const playWrong = () =>
  play([
    { freq: 311.13, start: 0, dur: 0.16, type: 'triangle', gain: 0.2 },
    { freq: 220, start: 0.13, dur: 0.28, type: 'triangle', gain: 0.2 },
  ]);

/** Đạt cả bài: ba nốt chúc mừng. */
export const playPassed = () =>
  play([
    { freq: 523.25, start: 0, dur: 0.14 },
    { freq: 659.25, start: 0.12, dur: 0.14 },
    { freq: 1046.5, start: 0.24, dur: 0.38 },
  ]);
