# save as debug_ffmpeg.py in your project folder
# run: python debug_ffmpeg.py

import os, shutil, subprocess, sys

print(f"Python: {sys.executable}")
print(f"CWD: {os.getcwd()}")

print("\n=== imageio_ffmpeg ===")
try:
    import imageio_ffmpeg
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Path: {exe}")
    print(f"Exists: {os.path.isfile(exe)}")
except Exception as e:
    print(f"FAILED: {e}")

print("\n=== PATH ffmpeg ===")
print(shutil.which("ffmpeg"))

print("\n=== _get_ffmpeg_bin() ===")
try:
    from fluency_service import _get_ffmpeg_bin
    path = _get_ffmpeg_bin()
    print(f"Returned: {path}")
    print(f"Exists: {os.path.isfile(path)}")
    # Test it actually runs
    r = subprocess.run([path, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"ffmpeg -version exit code: {r.returncode}")
except Exception as e:
    print(f"FAILED: {e}")