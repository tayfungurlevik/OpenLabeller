"""Build a standalone openlabeller-server.exe from the Python backend using
PyInstaller, and (optionally) the full Electron distributable that bundles it.

Usage:
    python scripts/build_windows_exe.py [--electron]

Produces backend/dist/openlabeller-server/openlabeller-server.exe (onedir
build). With --electron, also copies it into frontend/resources/backend/
and runs `npm run build` + `npx electron-builder` to produce a Windows
installer under frontend/release/.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def build_backend_exe() -> Path:
    python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    args = [
        str(python),
        "-m",
        "PyInstaller",
        "--name",
        "openlabeller-server",
        "--windowed",
        "--noconfirm",
        "--hidden-import",
        "soundfile",
        str(BACKEND_DIR / "openlabeller" / "__main__.py"),
    ]
    subprocess.check_call(args, cwd=str(BACKEND_DIR))
    return BACKEND_DIR / "dist" / "openlabeller-server"


def bundle_into_electron(built_dir: Path) -> None:
    resources_backend = FRONTEND_DIR / "resources" / "backend"
    if resources_backend.exists():
        shutil.rmtree(resources_backend)
    shutil.copytree(built_dir, resources_backend)

    subprocess.check_call(["npm", "run", "build"], cwd=str(FRONTEND_DIR), shell=True)
    subprocess.check_call(["npx", "electron-builder", "--win"], cwd=str(FRONTEND_DIR), shell=True)


def main() -> int:
    built_dir = build_backend_exe()
    print(f"Backend built at: {built_dir}")

    if "--electron" in sys.argv:
        bundle_into_electron(built_dir)
        print(f"Electron installer built under: {FRONTEND_DIR / 'release'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
