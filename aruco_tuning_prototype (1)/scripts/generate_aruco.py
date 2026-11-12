#!/usr/bin/env python3
"""Generate printable ArUco markers.

The rendered PNG is sized so that, when printed at **100% scale (no "fit to
page")**, the outer black border spans exactly ``--length-mm`` millimetres --
which is the value you must enter as ``marker_length_mm`` in the robot config.

Examples
--------
    # single 80 mm marker, id 0
    python scripts/generate_aruco.py --dict DICT_4X4_50 --id 0 --length-mm 80

    # a batch of ids 0..5 into ./markers
    python scripts/generate_aruco.py --ids 0-5 --length-mm 80 --out markers
"""

from __future__ import annotations

import argparse
import os
import sys

import cv2
import numpy as np

# allow running both as "python scripts/generate_aruco.py" and installed
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from aruco_tuning import aruco_detection  # noqa: E402


def parse_ids(spec: str) -> list:
    ids = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            ids.extend(range(int(a), int(b) + 1))
        elif part:
            ids.append(int(part))
    return ids


def mm_to_px(mm: float, dpi: int) -> int:
    return int(round(mm / 25.4 * dpi))


def make_marker(dictionary, marker_id: int, length_mm: float,
                margin_mm: float, dpi: int) -> np.ndarray:
    side_px = mm_to_px(length_mm, dpi)
    marker = cv2.aruco.generateImageMarker(dictionary, marker_id, side_px)
    margin_px = mm_to_px(margin_mm, dpi)
    canvas = cv2.copyMakeBorder(
        marker, margin_px, margin_px, margin_px, margin_px,
        cv2.BORDER_CONSTANT, value=255)
    canvas = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
    # annotate below the quiet zone (does not affect the marker itself)
    label = f"id={marker_id}  {length_mm:.0f}mm  100% scale"
    cv2.putText(canvas, label, (margin_px, canvas.shape[0] - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
    return canvas


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Gerar marcadores ArUco imprimíveis")
    p.add_argument("--dict", default="DICT_4X4_50",
                   help="Dicionário ArUco (padrão: DICT_4X4_50)")
    p.add_argument("--id", type=int, help="ID único do marcador")
    p.add_argument("--ids", type=str,
                   help="Vários IDs, ex.: '0-5' ou '0,2,4'")
    p.add_argument("--length-mm", type=float, default=80.0,
                   help="Lado da borda preta em mm (= marker_length_mm)")
    p.add_argument("--margin-mm", type=float, default=10.0,
                   help="Zona de silêncio branca ao redor (mm)")
    p.add_argument("--dpi", type=int, default=300, help="Resolução (DPI)")
    p.add_argument("--out", default="markers", help="Pasta de saída")
    args = p.parse_args(argv)

    if args.dict not in aruco_detection.ARUCO_DICTIONARIES:
        print(f"Dicionário desconhecido: {args.dict}")
        print("Disponíveis:", ", ".join(aruco_detection.list_dictionaries()))
        return 2

    dictionary = aruco_detection.get_dictionary(args.dict)
    ids = []
    if args.ids:
        ids = parse_ids(args.ids)
    if args.id is not None:
        ids.append(args.id)
    if not ids:
        ids = [0]

    os.makedirs(args.out, exist_ok=True)
    for mid in ids:
        img = make_marker(dictionary, mid, args.length_mm,
                          args.margin_mm, args.dpi)
        path = os.path.join(args.out, f"aruco_{args.dict}_id{mid}.png")
        cv2.imwrite(path, img)
        print(f"Gerado: {path}")

    print(f"\nIMPORTANTE: imprima em 100% (sem 'ajustar à página'). "
          f"A borda preta deve medir {args.length_mm:.0f} mm. "
          f"Meça com uma régua e use esse valor exato como marker_length_mm.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
