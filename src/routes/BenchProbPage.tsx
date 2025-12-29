import { useMemo, useRef, useState } from "react";

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  dot,
  pipeline,
  softmax,
} from "@huggingface/transformers";

type Backend = "webgpu" | "wasm";

type QualityPreset = "tiny" | "small" | "balanced" | "quality";

type DType = "fp32" | "fp16" | "q8" | "q4" | "q4f16" | "bnb4" | "int8" | "uint8";

type BenchProbResult = {
  probability: number;
  elapsedSeconds: number;
  backend: Backend;
};

type ZeroShotOutputRow = { label: string; score: number };

const BENCH_PROMPTS = [
  "a photo of a park bench",
  "a photo of a bench",
  "a wooden bench",
  "a metal bench",
  "a bench on a sidewalk",
  "a bench by a path",
  "a bench in a park",
  "a street bench",
];

const NON_BENCH_PROMPTS = [
  "a photo of a chair",
  "a photo of a table",
  "a photo of a couch",
  "a photo of a sofa",
  "a photo of a fence",
  "a photo of stairs",
  "a photo of a railing",
  "a photo of a bicycle",
  "a photo of a person",
  "a photo of a tree",
];

async function getBenchProb({
  image,
  backend,
  pipe,
}: {
  image: RawImage;
  backend: Backend;
  pipe: Awaited<ReturnType<typeof pipeline>>;
}): Promise<BenchProbResult> {
  const t0 = performance.now();

  const labels = [...BENCH_PROMPTS, ...NON_BENCH_PROMPTS];

  const out = (await pipe(image, labels)) as Array<{ label: string; score: number }>;

  const benchSet = new Set(BENCH_PROMPTS);
  const probability = out.reduce(
    (acc, x) => (benchSet.has(x.label) ? acc + x.score : acc),
    0,
  );

  const elapsedSeconds = (performance.now() - t0) / 1000;

  return {
    probability,
    elapsedSeconds,
    backend,
  };
}

async function getBenchProbMobileclip({
  image,
  backend,
  modelId,
  dtype,
  cache,
}: {
  image: RawImage;
  backend: Backend;
  modelId: string;
  dtype: DType;
  cache: {
    tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null;
    processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null;
    textModel: CLIPTextModelWithProjection | null;
    visionModel: CLIPVisionModelWithProjection | null;
  };
}): Promise<BenchProbResult> {
  const t0 = performance.now();

  if (!cache.tokenizer) {
    cache.tokenizer = await AutoTokenizer.from_pretrained(modelId);
  }
  if (!cache.processor) {
    cache.processor = await AutoProcessor.from_pretrained(modelId);
  }
  if (!cache.textModel) {
    cache.textModel = await CLIPTextModelWithProjection.from_pretrained(modelId, {
      device: backend,
      dtype,
    });
  }
  if (!cache.visionModel) {
    cache.visionModel = await CLIPVisionModelWithProjection.from_pretrained(modelId, {
      device: backend,
      dtype,
    });
  }

  const labels = [...BENCH_PROMPTS, ...NON_BENCH_PROMPTS];

  const textInputs = cache.tokenizer(labels, {
    padding: "max_length",
    truncation: true,
  });
  const { text_embeds } = await cache.textModel(textInputs);
  const normalizedText = text_embeds.normalize().tolist() as number[][];

  const imageInputs = await cache.processor(image);
  const { image_embeds } = await cache.visionModel(imageInputs);
  const normalizedImage = image_embeds.normalize().tolist() as number[];

  const scores = softmax(normalizedText.map((t) => 100 * dot(normalizedImage, t))) as number[];

  const out: ZeroShotOutputRow[] = labels.map((label, i) => ({
    label,
    score: scores[i] ?? 0,
  }));

  const benchSet = new Set(BENCH_PROMPTS);
  const probability = out.reduce(
    (acc, x) => (benchSet.has(x.label) ? acc + x.score : acc),
    0,
  );

  const elapsedSeconds = (performance.now() - t0) / 1000;

  return {
    probability,
    elapsedSeconds,
    backend,
  };
}

export function BenchProbPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BenchProbResult | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("balanced");

  const pipeRef = useRef<Record<Backend, Awaited<ReturnType<typeof pipeline>> | null>>({
    webgpu: null,
    wasm: null,
  });

  const mobileclipRef = useRef<
    Record<Backend, {
      tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null;
      processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null;
      textModel: CLIPTextModelWithProjection | null;
      visionModel: CLIPVisionModelWithProjection | null;
    }>
  >({
    webgpu: { tokenizer: null, processor: null, textModel: null, visionModel: null },
    wasm: { tokenizer: null, processor: null, textModel: null, visionModel: null },
  });

  const canTryWebgpu = useMemo(() => {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }, []);

  const modelId = qualityPreset === "tiny" ? "Xenova/mobileclip_s2" : "Xenova/clip-vit-base-patch32";

  const dtypeFor = (backend: Backend): DType => {
    // CLIP sizes from the model repo (approx):
    // - fp32: model.onnx ~606MB
    // - fp16: model_fp16.onnx ~304MB
    // - q4f16: model_q4f16.onnx ~126MB
    // MobileCLIP S2 examples (approx): vision_model_int8.onnx ~36.7MB, text_model_int8.onnx ~64.1MB
    // In practice, smaller dtypes can reduce accuracy, but are usually good enough for this task.
    // NOTE: Some runtimes (especially on web) don't support ConvInteger for int8 quantized convs.
    // uint8 is typically more broadly supported.
    if (qualityPreset === "tiny") return "uint8";
    if (qualityPreset === "quality") return backend === "webgpu" ? "fp16" : "q8";
    if (qualityPreset === "small") return "q4f16";
    return backend === "webgpu" ? "fp16" : "q4f16";
  };

  return (
    <div className="mx-auto flex h-dvh w-dvw max-w-3xl flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <div className="text-lg font-semibold">AI Bench Probability (in-browser)</div>
        <div className="text-sm text-slate-300">
          Runs fully on-device. Tries WebGPU first, falls back to WASM.
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-200">Image</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-950/50">
                Browse image
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setError(null);
                    setResult(null);
                    setStatusText(null);

                    const next = e.target.files?.[0] ?? null;
                    setFile(next);

                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(next ? URL.createObjectURL(next) : null);
                  }}
                />
              </label>
              <div className="text-xs text-slate-400">
                {file ? file.name : "No file selected"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-200">Model / size</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 sm:w-auto"
                value={qualityPreset}
                disabled={isLoading}
                onChange={(e) => {
                  setError(null);
                  setResult(null);
                  setStatusText(null);
                  setQualityPreset(e.target.value as QualityPreset);

                  // Clear cached pipelines so the next run downloads/loads the new dtype.
                  pipeRef.current.webgpu = null;
                  pipeRef.current.wasm = null;

                  mobileclipRef.current.webgpu = {
                    tokenizer: null,
                    processor: null,
                    textModel: null,
                    visionModel: null,
                  };
                  mobileclipRef.current.wasm = {
                    tokenizer: null,
                    processor: null,
                    textModel: null,
                    visionModel: null,
                  };
                }}
              >
                <option value="tiny">Tiny (mobileclip_s2 int8 ~100MB)</option>
                <option value="small">Small (q4f16 ~126MB)</option>
                <option value="balanced">Balanced (WebGPU fp16 ~304MB, WASM q4f16 ~126MB)</option>
                <option value="quality">Quality (WebGPU fp16 ~304MB, WASM q8)</option>
              </select>

              <div className="text-xs text-slate-400">Model: {modelId}</div>
            </div>
          </div>

          {previewUrl ? (
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/30">
              <img
                src={previewUrl}
                alt="Selected"
                className="max-h-[50vh] w-full object-contain"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
              disabled={!file || isLoading}
              onClick={async () => {
                if (!file) return;

                setError(null);
                setIsLoading(true);
                setResult(null);
                setStatusText(null);

                try {
                  const image = await RawImage.fromBlob(file);

                  // Try WebGPU first (if supported) then fall back to WASM.
                  const backendsToTry: Backend[] = canTryWebgpu ? ["webgpu", "wasm"] : ["wasm"];

                  let lastError: unknown = null;

                  for (const backend of backendsToTry) {
                    try {
                      const dtype = dtypeFor(backend);

                      if (qualityPreset === "tiny") {
                        const dtypeCandidates: DType[] = [dtype, "q4f16"];

                        let tinyOk = false;
                        let tinyError: unknown = null;

                        for (const tinyDtype of dtypeCandidates) {
                          try {
                            setStatusText(
                              `Loading model (${backend}, ${tinyDtype})… This may take a while the first time.`,
                            );

                            // If we are switching dtype, clear model instances so they get reloaded.
                            mobileclipRef.current[backend].textModel = null;
                            mobileclipRef.current[backend].visionModel = null;

                            const r = await getBenchProbMobileclip({
                              image,
                              backend,
                              modelId,
                              dtype: tinyDtype,
                              cache: mobileclipRef.current[backend],
                            });
                            setResult(r);
                            setStatusText(null);
                            tinyOk = true;
                            tinyError = null;
                            break;
                          } catch (e) {
                            tinyError = e;
                          }
                        }

                        if (!tinyOk) {
                          throw tinyError;
                        }

                        lastError = null;
                        break;
                      }

                      if (!pipeRef.current[backend]) {
                        setStatusText(
                          `Loading model (${backend}, ${dtype})… This may take a while the first time.`,
                        );
                        pipeRef.current[backend] = await pipeline(
                          "zero-shot-image-classification",
                          modelId,
                          {
                            device: backend,
                            dtype,
                          },
                        );
                      }

                      setStatusText(`Running inference (${backend}, ${dtype})…`);

                      const r = await getBenchProb({
                        image,
                        backend,
                        pipe: pipeRef.current[backend]!,
                      });
                      setResult(r);
                      setStatusText(null);
                      lastError = null;
                      break;
                    } catch (e) {
                      if (backend === "webgpu") {
                        setStatusText("WebGPU failed, falling back to WASM…");
                      }
                      lastError = e;
                    }
                  }

                  if (lastError) {
                    throw lastError;
                  }
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  setError(msg);
                } finally {
                  setIsLoading(false);
                  setStatusText(null);
                }
              }}
            >
              {isLoading ? "Running…" : "Compute bench probability"}
            </button>

            <div className="text-xs text-slate-400">
              WebGPU available: {canTryWebgpu ? "yes" : "no"}
            </div>
          </div>

          {statusText ? <div className="text-xs text-slate-300">{statusText}</div> : null}

          {error ? (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-md border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-sm text-slate-200">
                Probability: <span className="font-semibold">{result.probability.toFixed(3)}</span> (
                {(result.probability * 100).toFixed(1)}%)
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Backend: {result.backend} · Time: {result.elapsedSeconds.toFixed(3)}s
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Note: first run may be slower due to model download and backend warm-up.
      </div>
    </div>
  );
}
