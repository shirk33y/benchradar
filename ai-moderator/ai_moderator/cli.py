from __future__ import annotations

import argparse
import contextlib
import os
import time
from pathlib import Path
import sys

from ai_moderator.detector import BenchDetector, load_image


_IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".avif",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
}


def _iter_images(paths: list[str]) -> list[Path]:
    items: list[Path] = []
    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            for child in p.rglob("*"):
                if child.is_file() and child.suffix.lower() in _IMAGE_EXTS:
                    items.append(child)
        elif p.is_file():
            if p.suffix.lower() in _IMAGE_EXTS:
                items.append(p)
        else:
            # Non-existent path: ignore (reported only in verbose mode by caller)
            continue
    # Stable order
    items.sort(key=lambda x: str(x).lower())
    return items


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="bench-prob")
    parser.add_argument(
        "paths",
        nargs="+",
        help="One or more image file paths or directories (directories are scanned recursively)",
    )
    parser.add_argument(
        "--device",
        choices=["auto", "cpu", "cuda"],
        default="auto",
        help="Device to use for inference (default: auto)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args(argv)

    images = _iter_images(args.paths)
    if args.verbose and len(images) == 0:
        sys.stderr.write("No images found.\n")

    devnull = None
    try:
        # Configure output behavior for third-party libs.
        if args.verbose:
            # Allow warnings/logs to appear on stderr, but never let third-party libs write to stdout.
            lib_stdout_ctx: contextlib.AbstractContextManager = contextlib.redirect_stdout(sys.stderr)
            lib_stderr_ctx: contextlib.AbstractContextManager = contextlib.nullcontext()
        else:
            devnull = open(os.devnull, "w", encoding="utf-8")
            lib_stdout_ctx = contextlib.redirect_stdout(devnull)
            lib_stderr_ctx = contextlib.redirect_stderr(devnull)

        # Do model/library initialization under the lib output redirection.
        with lib_stdout_ctx, lib_stderr_ctx:
            try:
                from transformers.utils import logging as hf_logging

                if args.verbose:
                    hf_logging.disable_progress_bar()
                else:
                    hf_logging.set_verbosity_error()
                    hf_logging.disable_progress_bar()
            except Exception:
                pass

            device = None if args.device == "auto" else args.device
            detector = BenchDetector(device=device)

        # Process images; redirect only the detection work, not our own printing.
        for img_path in images:
            t0 = time.perf_counter()
            with lib_stdout_ctx, lib_stderr_ctx:
                image = load_image(str(img_path))
                result = detector.predict_probability(image)
            elapsed = time.perf_counter() - t0

            pct = round(result.probability * 100)
            # Format: name<2 spaces>NN%<2 spaces>T.s
            sys.stdout.write(f"{img_path.name}  {pct:2d}%  {elapsed:.3f}s\n")
    finally:
        if devnull is not None:
            devnull.close()


if __name__ == "__main__":
    main()
