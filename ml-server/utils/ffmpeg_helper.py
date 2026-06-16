"""
utils/ffmpeg_helper.py — Portable ffmpeg binary discovery.

Resolution order:
  1. imageio-ffmpeg managed binary
  2. site-packages scan
  3. System PATH
  4. Common Windows install locations
  5. Hardcoded fallback for known Windows layout
"""

import os
import shutil


def get_ffmpeg_bin() -> str:
    """Return a usable path to the ffmpeg executable, or raise RuntimeError."""

    # 1) imageio-ffmpeg managed binary
    try:
        import imageio_ffmpeg as _iio
        exe = _iio.get_ffmpeg_exe()
        if exe and os.path.isfile(exe):
            return exe
    except Exception:
        pass

    # 2) site-packages scan
    try:
        import glob as _glob
        import site as _site

        roots = []
        try:
            roots += _site.getsitepackages()
        except Exception:
            pass
        try:
            roots.append(_site.getusersitepackages())
        except Exception:
            pass
        roots.append(os.path.dirname(os.path.dirname(os.__file__)))

        for root in roots:
            for pat in [
                os.path.join(root, "imageio_ffmpeg", "binaries", "ffmpeg*.exe"),
                os.path.join(root, "imageio_ffmpeg", "binaries", "ffmpeg"),
            ]:
                matches = _glob.glob(pat)
                if matches:
                    return matches[0]
    except Exception:
        pass

    # 3) System PATH
    which = shutil.which("ffmpeg")
    if which:
        return which

    # 4) Common Windows install locations
    for p in [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.isfile(p):
            return p

    # 5) Hardcoded user-site fallback
    fallback = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Programs", "Python", "Python313", "Lib", "site-packages",
        "imageio_ffmpeg", "binaries", "ffmpeg-win-x86_64-v7.1.exe",
    )
    if os.path.isfile(fallback):
        return fallback

    raise RuntimeError(
        "ffmpeg not found. Install it with: pip install imageio-ffmpeg  "
        "OR  winget install ffmpeg"
    )
