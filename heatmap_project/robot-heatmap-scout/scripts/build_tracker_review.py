import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.tracker_review import build_tracker_review


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera review HTML do Tracker Lab")
    parser.add_argument(
        "--analysis-dir",
        required=True,
        help="Pasta da analise contendo positions.csv, tracker_events.csv e tracker_metrics.json",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Caminho do review.html; por padrao salva dentro da pasta de analise",
    )
    parser.add_argument(
        "--field",
        default=None,
        help="Caminho opcional do field.yaml quando tracker_metrics.json nao tiver field_path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.output or os.path.join(args.analysis_dir, "review.html")
    result = build_tracker_review(args.analysis_dir, output, field_path=args.field)
    print(f"Review salvo em: {result}")


if __name__ == "__main__":
    main()
