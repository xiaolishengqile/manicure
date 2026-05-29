import { toClientDisplayableImageUrl } from "@/lib/image-buffer-utils";
import type { GenerationMode } from "@/lib/generation-modes";

export type ParallelImageJobsResult =
  | { ok: true; imageUrls: string[]; labels: string[] }
  | { ok: false; error: string; imageUrls: string[]; labels: string[] };

type ParallelJobRow = {
  index: number;
  label: string;
  imageUrl: string | null;
  throwMessage: string | null;
};

function aggregateParallelJobRows(
  rows: ParallelJobRow[],
  minSuccessful: number,
): ParallelImageJobsResult {
  rows.sort((a, b) => a.index - b.index);
  const imageUrls: string[] = [];
  const labels: string[] = [];
  const failures: string[] = [];
  for (const row of rows) {
    if (!row.imageUrl) {
      const err =
        row.throwMessage ??
        `模型未返回第 ${row.index + 1} 张图片（既无 url 也无 b64_json）。`;
      failures.push(`${row.label}: ${err}`);
      continue;
    }
    imageUrls.push(row.imageUrl);
    labels.push(row.label);
  }
  if (imageUrls.length >= minSuccessful) {
    return { ok: true, imageUrls, labels };
  }
  const err =
    failures.length > 0 ? failures.join("；") : "模型未返回任何图片。";
  return { ok: false, error: err, imageUrls, labels };
}

export async function runParallelImageJobRows(args: {
  jobs: { prompt: string; label: string }[];
  replicateDownloadAuth?: string;
  edit: (
    job: { prompt: string; label: string },
    index: number,
  ) => Promise<string | null>;
  onJobImageReady?: (payload: {
    index: number;
    label: string;
    imageUrl: string;
  }) => void;
}): Promise<ParallelJobRow[]> {
  const { jobs, replicateDownloadAuth, edit, onJobImageReady } = args;
  return Promise.all(
    jobs.map(async (job, index) => {
      try {
        const url = await edit(job, index);
        if (!url) {
          return {
            index,
            label: job.label,
            imageUrl: null,
            throwMessage: null as string | null,
          };
        }
        const imageUrl =
          (await toClientDisplayableImageUrl(url, replicateDownloadAuth)) ??
          url;
        onJobImageReady?.({ index, label: job.label, imageUrl });
        return {
          index,
          label: job.label,
          imageUrl,
          throwMessage: null as string | null,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          index,
          label: job.label,
          imageUrl: null,
          throwMessage: msg,
        };
      }
    }),
  );
}

export async function runParallelImageEditJobs(args: {
  jobs: { prompt: string; label: string }[];
  replicateDownloadAuth?: string;
  minSuccessful?: number;
  edit: (
    job: { prompt: string; label: string },
    index: number,
  ) => Promise<string | null>;
}): Promise<ParallelImageJobsResult> {
  const minSuccessful = args.minSuccessful ?? args.jobs.length;
  const rows = await runParallelImageJobRows({
    jobs: args.jobs,
    replicateDownloadAuth: args.replicateDownloadAuth,
    edit: args.edit,
  });
  return aggregateParallelJobRows(rows, minSuccessful);
}

export function ndjsonStreamParallelImageJobsResponse(args: {
  jobs: { prompt: string; label: string }[];
  replicateDownloadAuth?: string;
  minSuccessful?: number;
  mode: GenerationMode;
  edit: (
    job: { prompt: string; label: string },
    index: number,
  ) => Promise<string | null>;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      try {
        send({
          type: "meta",
          jobCount: args.jobs.length,
          mode: args.mode,
        });
        const minSuccessful = args.minSuccessful ?? args.jobs.length;
        const rows = await runParallelImageJobRows({
          jobs: args.jobs,
          replicateDownloadAuth: args.replicateDownloadAuth,
          edit: args.edit,
          onJobImageReady: ({ index, label, imageUrl }) => {
            send({ type: "image", index, label, imageUrl });
          },
        });
        const outcome = aggregateParallelJobRows(rows, minSuccessful);
        send({
          type: "done",
          ok: outcome.ok,
          error: outcome.ok ? undefined : outcome.error,
          imageUrls: outcome.imageUrls,
          labels: outcome.labels,
          mode: args.mode,
        });
      } catch (e) {
        send({
          type: "done",
          ok: false,
          error: e instanceof Error ? e.message : "图像编辑接口调用失败",
          imageUrls: [] as string[],
          labels: [] as string[],
          mode: args.mode,
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
