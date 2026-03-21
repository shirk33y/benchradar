# ai-detector

## Examples
- Place sample images in `ai-detector/examples/`.
- Copied from `/mnt/c/Users/shirk3y/Downloads`:
  - `bench0001.jpg` ... `bench0014.webp` (mixed formats)

## Running the detector
- See `ai-moderator/README.md` for install/run instructions.

## Troubleshooting log
- If `uv`/runtime errors happen while running the detector against images in `examples/`, document them here.

### 2025-12-16: `uv` not installed
- **Command attempted**
  - `uv venv && uv pip install -e ./ai-moderator && uv run bench-prob ai-detector/examples/bench0001.jpg`
- **Error**
  - `Command 'uv' not found`
  - Shell also suggested: `sudo snap install astral-uv`
- **Fix**
  - Install `uv` (Astral).
  - After installation, rerun the command above.

### 2025-12-16: Install `uv` without root via a venv (pip)
If you don't have root access (or don't want to use `snap`), you can install `uv` into a local virtualenv and use the `uv` binary from that env.

- **Create a venv (repo-local)**
  - `python3 -m venv .venv-uv`
  - `. .venv-uv/bin/activate`
- **Install uv into that venv**
  - `python -m pip install -U pip`
  - `python -m pip install uv`
- **Use that uv to run the detector**
  - `uv pip install -e ./ai-moderator`
  - `uv run bench-prob ai-detector/examples/bench0001.jpg`

- **Caveat (PyPI build)**
  - Per uv docs, `pip install uv` usually uses prebuilt wheels, but if a wheel isn't available for your platform, it may try to build from source and require a Rust toolchain.

### 2025-12-16: venv creation failed (`ensurepip` missing)
- **Command attempted**
  - `python3 -m venv .venv-uv`
- **Error**
  - `ensurepip is not available`
- **Cause (Debian/Ubuntu)**
  - `python3 -m venv` requires the OS package `python3-venv`.
- **Fix (requires sudo)**
  - `sudo apt install python3.12-venv` (or the matching `python3-venv` for your Python version)
- **No-root alternative**
  - Use Astral's standalone installer (installs to user dir, typically `~/.local/bin`):
    - `curl -LsSf https://astral.sh/uv/install.sh | sh`

### 2025-12-16: Working setup (no root) using Astral installer + `uv venv`
This is the sequence that worked end-to-end on this machine.

- **Install uv to user dir**
  - `curl -LsSf https://astral.sh/uv/install.sh | sh`
  - Installer output indicated install path: `~/.local/bin`.
- **Load uv into PATH (current shell)**
  - `source ~/.local/bin/env`
  - Verify: `uv --version`
- **Create a venv (uv-managed)**
  - `uv venv .venv-ai`
  - `. .venv-ai/bin/activate`
- **Install the local ai-moderator package**
  - `uv pip install -e ./ai-moderator`
- **Run on first JPEG**
  - `bench-prob ai-detector/examples/bench0001.jpg`
  - **Output**: `0.878735`

- **Notes**
  - Using `uv pip install --user ...` does not work (uv reports pip `--user` is unsupported); use a venv.
  - The first run downloads the CLIP model weights; expect large downloads.
