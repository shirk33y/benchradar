from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


@dataclass(frozen=True)
class BenchDetectionResult:
    probability: float


_BENCH_PROMPTS: tuple[str, ...] = (
    "a park bench",
    "a wooden bench outdoors",
    "a metal bench in a park",
    "a sitting bench",
)

_NON_BENCH_PROMPTS: tuple[str, ...] = (
    "a chair",
    "a sofa",
    "a table",
    "a street",
    "a tree",
    "no bench",
)


class BenchDetector:
    def __init__(
        self,
        model_id: str = "openai/clip-vit-base-patch32",
        device: str | None = None,
    ) -> None:
        self.model_id = model_id
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = CLIPProcessor.from_pretrained(model_id)
        self._model = CLIPModel.from_pretrained(model_id)
        self._model.to(self.device)
        self._model.eval()

    def predict_probability(
        self,
        image: Image.Image,
        bench_prompts: Iterable[str] = _BENCH_PROMPTS,
        non_bench_prompts: Iterable[str] = _NON_BENCH_PROMPTS,
    ) -> BenchDetectionResult:
        bench_prompts = tuple(bench_prompts)
        non_bench_prompts = tuple(non_bench_prompts)
        texts = bench_prompts + non_bench_prompts

        inputs = self._processor(text=list(texts), images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)
            logits_per_image = outputs.logits_per_image  # shape: [1, num_texts]
            probs = logits_per_image.softmax(dim=1)[0]

        bench_prob = float(probs[: len(bench_prompts)].sum().item())
        bench_prob = max(0.0, min(1.0, bench_prob))
        return BenchDetectionResult(probability=bench_prob)


def load_image(path: str) -> Image.Image:
    img = Image.open(path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img
