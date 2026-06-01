import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class SessionSummary:
    started_at: datetime
    ended_at: datetime
    pushups: int
    squats: int


def save_session(summary: SessionSummary, records_dir: str = "records") -> Path:
    output_dir = Path(records_dir)
    output_dir.mkdir(exist_ok=True)

    filename = f"session_{summary.ended_at.strftime('%Y%m%d_%H%M%S')}.csv"
    path = output_dir / filename

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["started_at", "ended_at", "duration_seconds", "pushups", "squats"])
        writer.writerow(
            [
                summary.started_at.isoformat(timespec="seconds"),
                summary.ended_at.isoformat(timespec="seconds"),
                int((summary.ended_at - summary.started_at).total_seconds()),
                summary.pushups,
                summary.squats,
            ]
        )

    return path
