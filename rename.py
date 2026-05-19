from pathlib import Path

def rename_files(folder_path: str):
    # Folder containing the files
    folder = Path(folder_path)

    # Get all matching files and sort them
    files = sorted(folder.glob("slice_*.png"))

    # Rename files continuously
    for new_idx, file_path in enumerate(files):
        new_name = f"slice_{new_idx:03d}.png"
        new_path = folder / new_name

        print(f"{file_path.name} -> {new_name}")
        file_path.rename(new_path)

folder_path_list = [
    "scan/cens_time_12.0_pid_1001205_0/slices_x/eigencam",
    "scan/cens_time_12.0_pid_1001205_0/slices_y/eigencam",
    "scan/cens_time_12.0_pid_1001205_0/slices_z/eigencam"
]

for folder_path in folder_path_list:
    rename_files(folder_path)