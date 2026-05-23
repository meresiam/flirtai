"use client";

import { useCallback, useState } from "react";
import { createWorker, type Worker } from "tesseract.js";

type OcrStatus = "idle" | "loading" | "recognizing" | "error";

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(["por", "eng"], 1, {
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
    });
  }
  return workerPromise;
}

export interface UseOcrApi {
  status: OcrStatus;
  progress: number;
  error: string | null;
  recognize: (file: File) => Promise<string>;
  reset: () => void;
}

export function useOcr(): UseOcrApi {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (file: File) => {
    setError(null);
    setProgress(0);
    setStatus("loading");
    try {
      const worker = await getWorker();
      setStatus("recognizing");
      const result = await worker.recognize(file);
      const text = result.data.text.trim();
      setProgress(1);
      setStatus("idle");
      return text;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Falhou ao ler a imagem.";
      setError(message);
      setStatus("error");
      throw cause;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { status, progress, error, recognize, reset };
}
