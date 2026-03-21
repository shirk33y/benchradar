# ai-moderator (local CLI)

## Install (uv)
```bash
uv venv
uv pip install -e ./ai-moderator
```

## Run
```bash
uv run bench-prob /path/to/image.jpg
# or
uv run python -m ai_moderator /path/to/image.jpg
```

## Output
- Prints a single float in `[0, 1]` representing the probability that the image contains a park-style sitting bench.

## Notes
- Default model: `openai/clip-vit-base-patch32` (downloads on first run).
- Override model:
```bash
uv run bench-prob --model openai/clip-vit-large-patch14 /path/to/image.jpg
```
