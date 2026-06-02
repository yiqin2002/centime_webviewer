from pathlib import Path
import re

def downscale_slices(pid_folder: str, n_slices: int = 240):
    """
    Downscale slice images from n_slices to n_slices / 2 by:
    1. Physically deleting odd-indexed slices: slice_001.png, slice_003.png, ...
    2. Renaming remaining even-indexed slices continuously:
       slice_000.png, slice_002.png, ... -> slice_000.png, slice_001.png, ...

    Expected structure:
        ~/PID_xxx/{slices_x,slices_y,slices_z}/{centime,centime_beta0,centime_beta1,ct,eigencam}/slice_002.png
    """

    root = Path(pid_folder).expanduser()

    slice_dirs = ["slices_x", "slices_y", "slices_z"]
    methods = ["centime", "centime_beta0", "centime_beta1", "ct", "eigencam"]

    for slice_dir in slice_dirs:
        for method in methods:
            folder = root / slice_dir / method

            if not folder.exists():
                continue

            # Step 1: physically delete odd-indexed images
            for i in range(1, n_slices, 2):
                file = folder / f"slice_{i:03d}.png"
                if file.exists():
                    file.unlink()

            # Step 2: rename remaining even-indexed images continuously
            remaining = sorted(
                folder.glob("slice_*.png"),
                key=lambda f: int(re.search(r"slice_(\d+)", f.stem).group(1))
            )

            # Temporary rename to avoid collisions
            for new_idx, file in enumerate(remaining):
                tmp_file = folder / f"__tmp_{new_idx:03d}.png"
                file.rename(tmp_file)

            # Final rename
            tmp_files = sorted(folder.glob("__tmp_*.png"))

            for new_idx, file in enumerate(tmp_files):
                new_file = folder / f"slice_{new_idx:03d}.png"
                file.rename(new_file)

    print(f"Finished downscaling slices under: {root}")

if __name__ == "__main__":
    pid_folders = [
        "scan/cens_time_8.0_pid_1000486_0",
    ]

    for pid_folder in pid_folders:
        downscale_slices(pid_folder)