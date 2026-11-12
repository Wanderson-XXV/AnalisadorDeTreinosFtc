#!/usr/bin/env python3
"""Entry point for the ArUco robot-tuning prototype.

Run with::

    python app.py

If no graphical display is available (headless server / SSH without X), the
program prints a friendly message in Portuguese and exits cleanly instead of
crashing. In that case you can still:

* run the unit tests:            ``pytest tests/``
* generate markers / boards:     ``python scripts/generate_aruco.py ...``
"""

from __future__ import annotations

import os
import sys

# Make ``src`` importable when running from a source checkout.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "src"))


def _has_display() -> bool:
    """Best-effort check for an available Qt platform / display."""
    if sys.platform.startswith("win") or sys.platform == "darwin":
        return True
    # explicit offscreen request is fine (used by tests/CI)
    if os.environ.get("QT_QPA_PLATFORM", "").strip():
        return True
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


_HEADLESS_MESSAGE = (
    "\n=============================================================\n"
    " Protótipo de Ajuste ArUco - Rastreamento de Robô\n"
    "=============================================================\n"
    " Nenhum ambiente gráfico (display) foi detectado, portanto a\n"
    " interface não pode ser aberta neste terminal.\n\n"
    " Você ainda pode:\n"
    "   • Executar os testes:        pytest tests/\n"
    "   • Gerar marcadores ArUco:    python scripts/generate_aruco.py --help\n"
    "   • Gerar tabuleiro ChArUco:   python scripts/generate_charuco.py --help\n\n"
    " Para abrir a interface, execute em uma máquina com tela (ou\n"
    " defina QT_QPA_PLATFORM=offscreen para um teste sem janela).\n"
    "=============================================================\n"
)


def main() -> int:
    if not _has_display():
        print(_HEADLESS_MESSAGE)
        return 0

    try:
        from PySide6.QtWidgets import QApplication
    except Exception as exc:  # pragma: no cover - import guard
        print("PySide6 não está instalado. Rode: pip install -r requirements.txt")
        print(f"Detalhe: {exc}")
        return 1

    try:
        app = QApplication(sys.argv)
    except Exception as exc:
        # e.g. "could not connect to display"
        print(_HEADLESS_MESSAGE)
        print(f"(Detalhe técnico: {exc})")
        return 0

    from aruco_tuning.ui.main_window import MainWindow

    base_dir = os.path.dirname(os.path.abspath(__file__))
    window = MainWindow(base_dir=base_dir)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
