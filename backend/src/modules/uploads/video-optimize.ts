import { CreateJobCommand, GetJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { env } from '../../config/env.js';

/**
 * Chuyển mã video bài học sang bản "web" bằng AWS MediaConvert: H.264 QVBR tối đa ~6 Mbps + AAC 128k + moov ở ĐẦU file
 * (progressive download / faststart) để trình duyệt bắt đầu phát và tua ngay, không phải tải cả file hay đọc đuôi file.
 * Bản gốc (thường 30-50 Mbps) giữ nguyên làm nguồn; bản web nằm ở `web/<khóa không đuôi>.mp4` trong cùng bucket.
 * Chỉ bật khi có MEDIACONVERT_ROLE_ARN + S3_BUCKET (dev/test bỏ trống = không làm gì, phát bản gốc).
 */
export const optimizeEnabled = () => !!env.MEDIACONVERT_ROLE_ARN && !!env.S3_BUCKET;

/** Khóa S3 của bản web ứng với khóa file gốc (`abc.mp4` -> `web/abc.mp4`). */
export const webKeyOf = (key: string) => `web/${key.replace(/\.[a-z0-9]+$/i, '')}.mp4`;

let client: MediaConvertClient | undefined;
const mc = () => (client ??= new MediaConvertClient({ region: env.S3_REGION, maxAttempts: 3 }));

/** Tạo job chuyển mã; trả JobId. */
export async function startOptimizeJob(key: string): Promise<string> {
  const bucket = env.S3_BUCKET!;
  const dest = `s3://${bucket}/web/${key.replace(/\.[a-z0-9]+$/i, '')}`;
  const res = await mc().send(
    new CreateJobCommand({
      Role: env.MEDIACONVERT_ROLE_ARN!,
      UserMetadata: { key },
      Settings: {
        TimecodeConfig: { Source: 'ZEROBASED' },
        Inputs: [{ FileInput: `s3://${bucket}/${key}`, TimecodeSource: 'ZEROBASED', AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } }, VideoSelector: {} }],
        OutputGroups: [
          {
            Name: 'File Group',
            OutputGroupSettings: { Type: 'FILE_GROUP_SETTINGS', FileGroupSettings: { Destination: dest } },
            Outputs: [
              {
                ContainerSettings: { Container: 'MP4', Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' } },
                VideoDescription: {
                  CodecSettings: {
                    Codec: 'H_264',
                    H264Settings: {
                      RateControlMode: 'QVBR',
                      QvbrSettings: { QvbrQualityLevel: 7 },
                      MaxBitrate: 6_000_000,
                      CodecProfile: 'HIGH',
                      SceneChangeDetect: 'TRANSITION_DETECTION',
                      GopSize: 2,
                      GopSizeUnits: 'SECONDS',
                    },
                  },
                },
                AudioDescriptions: [{ AudioSourceName: 'Audio Selector 1', CodecSettings: { Codec: 'AAC', AacSettings: { Bitrate: 128_000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48_000 } } }],
              },
            ],
          },
        ],
      },
    }),
  );
  const id = res.Job?.Id;
  if (!id) throw new Error('MediaConvert không trả JobId');
  return id;
}

export type JobState = 'processing' | 'ready' | 'failed';

const lastCheck = new Map<string, { at: number; state: JobState }>();
const POLL_MS = 5_000;

/** Trạng thái job (có đệm 5s/job để nhiều người xem cùng lúc không gọi MediaConvert dồn dập). */
export async function jobState(jobId: string): Promise<JobState> {
  const hit = lastCheck.get(jobId);
  if (hit && Date.now() - hit.at < POLL_MS) return hit.state;
  const res = await mc().send(new GetJobCommand({ Id: jobId }));
  const s = res.Job?.Status;
  const state: JobState = s === 'COMPLETE' ? 'ready' : s === 'ERROR' || s === 'CANCELED' ? 'failed' : 'processing';
  lastCheck.set(jobId, { at: Date.now(), state });
  if (state !== 'processing') setTimeout(() => lastCheck.delete(jobId), 60_000).unref();
  return state;
}
