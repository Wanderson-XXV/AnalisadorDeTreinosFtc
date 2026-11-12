#!/usr/bin/env python3
"""Generate a printable ChArUco calibration board.

Print at **100% scale (no "fit to page")** and verify the printed square size
with a ruler. Enter the measured square/marker sizes in the calibration config
so the intrinsic calibration is metrically correct.

Example
-------
    python scripts/generate_charuco.py \
        --squares-x 7 --squares-y 5 \
        --square-mm 30 --marker-mm 22 \
        --dict DICT_5X5_1000 --out charuco_board.png
"""

from __future__ import annotations

import argparse
import os
import sys

import cv2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from aruco_tuning import aruco_detection  # noqa: E402
from aruco_tuning.camera_calibration import (CameraCalibrator,  # noqa: E402
                                             CharucoBoardSpec)
from aruco_tuning import persistence  # noqa: E402


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Gerar tabuleiro ChArUco imprimível")
    p.add_argument("--squares-x", type=int, default=7)
    p.add_argument("--squares-y", type=int, default=5)
    p.add_argument("--square-mm", type=float, default=30.0,
                   help="Lado de cada quadrado (mm)")
    p.add_argument("--marker-mm", type=float, default=22.0,
                   help="Lado de cada marcador ArUco interno (mm)")
    p.add_argument("--dict", default="DICT_5X5_1000")
    p.add_argument("--dpi", type=int, default=300)
    p.add_argument("--margin-mm", type=float, default=10.0)
    p.add_argument("--out", default="charuco_board.png")
    p.add_argument("--save-spec", default="",
                   help="Salvar também o YAML da especificação do tabuleiro")
    args = p.parse_args(argv)

    if args.dict not in aruco_detection.ARUCO_DICTIONARIES:
        print(f"Dicionário desconhecido: {args.dict}")
        print("Disponíveis:", ", ".join(aruco_detection.list_dictionaries()))
        return 2
    if args.marker_mm >= args.square_mm:
        print("marker-mm deve ser menor que square-mm.")
        return 2

    spec = CharucoBoardSpec(
        squares_x=args.squares_x, squares_y=args.squares_y,
        square_length_mm=args.square_mm, marker_length_mm=args.marker_mm,
        dictionary=args.dict)
    calibrator = CameraCalibrator(spec)
    pixels_per_mm = args.dpi / 25.4
    img = calibrator.generate_board_image(
        pixels_per_mm=pixels_per_mm, margin_mm=args.margin_mm)

    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    cv2.imwrite(out, img)
    print(f"Gerado: {out}  ({img.shape[1]}x{img.shape[0]} px @ {args.dpi} DPI)")

    if args.save_spec:
        persistence.save_board_spec(spec, args.save_spec)
        print(f"Especificação salva em: {args.save_spec}")

    total_w = args.squares_x * args.square_mm + 2 * args.margin_mm
    total_h = args.squares_y * args.square_mm + 2 * args.margin_mm
    print(f"\nIMPORTANTE: imprima em 100% (sem 'ajustar à página'). "
          f"Tamanho impresso ~ {total_w:.0f} x {total_h:.0f} mm. "
          f"Confira o lado de um quadrado com a régua: deve medir "
          f"{args.square_mm:.0f} mm.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
