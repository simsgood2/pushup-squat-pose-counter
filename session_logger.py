import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class SessionSummary:
    started_at: datetime
    ended_at: datetime
    mode: str
    pushup_goal: int
    squat_goal: int
    pushups: int
    squats: int
    completed: bool

    @property
    def duration_seconds(self) -> int:
        return int((self.ended_at - self.started_at).total_seconds())

    @property
    def total_reps(self) -> int:
        return self.pushups + self.squats

    @property
    def reps_per_minute(self) -> float:
        minutes = self.duration_seconds / 60
        if minutes <= 0:
            return 0.0
        return self.total_reps / minutes


SESSION_FIELDS = [
    "started_at",
    "ended_at",
    "duration_seconds",
    "mode",
    "pushup_goal",
    "squat_goal",
    "pushups",
    "squats",
    "total_reps",
    "reps_per_minute",
    "completed",
]

SUMMARY_FIELDS = ["session_file", *SESSION_FIELDS]


def save_session(summary: SessionSummary, records_dir: str = "records") -> Path:
    output_dir = Path(records_dir)
    output_dir.mkdir(exist_ok=True)

    filename = f"session_{summary.ended_at.strftime('%Y%m%d_%H%M%S')}.csv"
    path = output_dir / filename

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(SESSION_FIELDS)
        writer.writerow(session_row(summary))

    append_summary(summary, path, output_dir / "summary.csv")

    return path


def append_summary(summary: SessionSummary, session_path: Path, summary_path: Path) -> None:
    should_write_header = not summary_path.exists()

    with summary_path.open("a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        if should_write_header:
            writer.writerow(SUMMARY_FIELDS)

        writer.writerow([session_path.name, *session_row(summary)])


def session_row(summary: SessionSummary) -> list:
    return [
        summary.started_at.isoformat(timespec="seconds"),
        summary.ended_at.isoformat(timespec="seconds"),
        summary.duration_seconds,
        summary.mode,
        summary.pushup_goal,
        summary.squat_goal,
        summary.pushups,
        summary.squats,
        summary.total_reps,
        f"{summary.reps_per_minute:.2f}",
        int(summary.completed),
    ]
