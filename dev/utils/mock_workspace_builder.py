from pathlib import Path
import os
import shutil
import json


def _detect_project_root() -> Path:
    here = Path(__file__).resolve()
    for p in [here.parent, *here.parents]:
        if (p / "bridge").is_dir() or (p / "requirements.txt").exists():
            return p.absolute()
    try:
        return here.parents[2].absolute()
    except Exception:
        return here.parent.absolute()


def prepare_job_workspace(job_id, commands_data, target_filename=None, copy_components=True):
    project_root = _detect_project_root()
    exchange_dir = project_root / "exchange"
    dev_dir = project_root / "dev"

    job_dir = exchange_dir / "jobs" / job_id
    input_dir = job_dir / "input"
    input_source_files_dir = input_dir / "source_files"
    input_components_dir = input_dir / "components"
    output_dir = job_dir / "output"
    output_ai_dir = output_dir / "ai"
    output_pdf_dir = output_dir / "pdf"
    output_logs_dir = output_dir / "logs"

    for d in [input_source_files_dir, output_ai_dir, output_pdf_dir, output_logs_dir]:
        d.mkdir(parents=True, exist_ok=True)

    if copy_components:
        dev_components = dev_dir / "input" / "components"
        if dev_components.exists():
            if input_components_dir.exists():
                shutil.rmtree(input_components_dir)
            shutil.copytree(dev_components, input_components_dir)
        else:
            input_components_dir.mkdir(exist_ok=True)

    if target_filename is None:
        target_filename = commands_data.get("targetFile", "template.ai")

    template_src = dev_dir / "input" / "source_files" / target_filename
    if not template_src.exists():
        fallback_src = dev_dir / "input" / "source_files" / "template.ai"
        if fallback_src.exists():
            template_src = fallback_src
            target_filename = "template.ai"
        else:
            raise FileNotFoundError(f"Template file not found: {template_src}")

    template_dest = input_source_files_dir / target_filename
    shutil.copy2(template_src, template_dest)
    print(f"DEBUG: File created at: {os.path.abspath(template_dest)}")

    commands_file = input_dir / "commands.json"
    if "targetFile" not in commands_data:
        commands_data["targetFile"] = target_filename
    with open(commands_file, "w", encoding="utf-8") as f:
        json.dump(commands_data, f, indent=2, ensure_ascii=False)
    print(f"DEBUG: File created at: {os.path.abspath(commands_file)}")

    return {
        "project_root": project_root,
        "job_dir": job_dir,
        "input_dir": input_dir,
        "input_source_files_dir": input_source_files_dir,
        "input_components_dir": input_components_dir,
        "output_dir": output_dir,
        "output_ai_dir": output_ai_dir,
        "output_pdf_dir": output_pdf_dir,
        "output_logs_dir": output_logs_dir,
        "template_dest": template_dest,
        "commands_json": commands_file,
    }
