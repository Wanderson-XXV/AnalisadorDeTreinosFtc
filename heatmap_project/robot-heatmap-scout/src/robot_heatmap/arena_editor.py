import cv2
import numpy as np

from robot_heatmap.coordinates import Coordinates
from robot_heatmap.field_config import FieldConfig
from robot_heatmap.zones import is_valid_polygon

HELP_TEXT = """
=== Arena Configurator — Teclas ===
  z       Nova zona (poligono)
  p       Novo ponto de referencia
  u       Desfazer ultimo ponto
  Enter   Finalizar poligono atual
  s       Salvar YAML
  q       Sair
  r       Resetar desenho atual
  h       Mostrar esta ajuda
"""

COLOR_ZONE = (0, 200, 100)
COLOR_POINT = (0, 100, 255)
COLOR_CURRENT = (50, 180, 255)
COLOR_VERTEX = (255, 255, 0)
COLOR_REFPT = (0, 180, 255)
FONT = cv2.FONT_HERSHEY_SIMPLEX


class ArenaEditor:
    def __init__(
        self,
        image_path: str,
        output_path: str,
        load_path: str = None,
        unit: str = "normalized",
        field_width: float = 1000,
        field_height: float = 1000,
    ):
        self.image_path = image_path
        self.output_path = output_path

        if load_path:
            self.config = FieldConfig.from_file(load_path)
        else:
            self.config = FieldConfig(image=image_path, unit=unit, width=field_width, height=field_height)

        self._orig = cv2.imread(image_path)
        if self._orig is None:
            raise FileNotFoundError(f"Imagem nao encontrada: {image_path}")

        self.img_h, self.img_w = self._orig.shape[:2]
        self.coords = Coordinates(
            self.img_w,
            self.img_h,
            self.config.field.get("width", 1000),
            self.config.field.get("height", 1000),
        )

        self._mode = None
        self._current_points = []
        self._window = "Arena Configurator"

    def _canvas(self):
        return self._orig.copy()

    def _draw_saved(self, canvas):
        for zone_id, zone in self.config.zones.items():
            pts = zone.get("points", [])
            if len(pts) >= 2:
                img_pts = [self.coords.to_image(p[0], p[1]) for p in pts]
                arr = np.array(img_pts, dtype=np.int32)
                cv2.polylines(canvas, [arr], isClosed=True, color=COLOR_ZONE, thickness=2)
                cx = int(np.mean([p[0] for p in img_pts]))
                cy = int(np.mean([p[1] for p in img_pts]))
                cv2.putText(canvas, zone.get("label", zone_id), (cx, cy), FONT, 0.5, COLOR_ZONE, 1, cv2.LINE_AA)
            for p in pts:
                ip = self.coords.to_image(p[0], p[1])
                cv2.circle(canvas, ip, 4, COLOR_VERTEX, -1)

        for pt_id, rp in self.config.reference_points.items():
            pt = rp.get("point", [])
            if len(pt) == 2:
                ip = self.coords.to_image(pt[0], pt[1])
                cv2.circle(canvas, ip, 6, COLOR_REFPT, -1)
                cv2.putText(canvas, rp.get("label", pt_id), (ip[0] + 8, ip[1] - 4), FONT, 0.4, COLOR_REFPT, 1, cv2.LINE_AA)

    def _draw_current(self, canvas):
        if not self._current_points:
            return
        img_pts = [self.coords.to_image(p[0], p[1]) for p in self._current_points]
        for ip in img_pts:
            cv2.circle(canvas, ip, 4, COLOR_CURRENT, -1)
        if len(img_pts) >= 2:
            arr = np.array(img_pts, dtype=np.int32)
            cv2.polylines(canvas, [arr], isClosed=False, color=COLOR_CURRENT, thickness=1)

    def _render(self):
        canvas = self._canvas()
        self._draw_saved(canvas)
        self._draw_current(canvas)
        mode_label = f"Modo: {self._mode or 'nenhum'}"
        cv2.putText(canvas, mode_label, (8, 20), FONT, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(canvas, "h=ajuda  s=salvar  q=sair", (8, self.img_h - 8), FONT, 0.4, (200, 200, 200), 1, cv2.LINE_AA)
        cv2.imshow(self._window, canvas)

    def _on_mouse(self, event, x, y, flags, param):
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if self._mode not in ("zone", "point"):
            print("[aviso] Nenhum modo ativo. Pressione z (zona) ou p (ponto).")
            return
        field_pt = self.coords.to_field(x, y)
        self._current_points.append(field_pt)
        print(f"  Ponto adicionado: imagem=({x},{y}) campo={field_pt}")
        self._render()

    def _ask(self, prompt: str, default: str = "") -> str:
        val = input(prompt).strip()
        return val if val else default

    def _finalize_zone(self):
        if not is_valid_polygon(self._current_points):
            print("[erro] Zona precisa de pelo menos 3 pontos.")
            return
        zone_id = self._ask("ID da zona (ex: center): ", "zona")
        label = self._ask("Label da zona (ex: Centro): ", zone_id)
        self.config.add_zone(zone_id, label, self._current_points)
        print(f"[ok] Zona '{zone_id}' salva com {len(self._current_points)} pontos.")
        self._current_points = []
        self._mode = None

    def _finalize_point(self):
        if not self._current_points:
            print("[erro] Nenhum ponto marcado.")
            return
        pt = self._current_points[-1]
        pt_id = self._ask("ID do ponto (ex: top_left): ", "ponto")
        label = self._ask("Label do ponto (ex: Canto superior esquerdo): ", pt_id)
        self.config.add_reference_point(pt_id, label, pt)
        print(f"[ok] Ponto de referencia '{pt_id}' salvo: {pt}")
        self._current_points = []
        self._mode = None

    def run(self):
        cv2.namedWindow(self._window, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(self._window, self._on_mouse)
        print(HELP_TEXT)
        self._render()

        while True:
            key = cv2.waitKey(30) & 0xFF

            if key == ord("q"):
                break
            elif key == ord("h"):
                print(HELP_TEXT)
            elif key == ord("z"):
                self._mode = "zone"
                self._current_points = []
                print("[modo] Zona — clique para adicionar pontos. Enter para finalizar.")
                self._render()
            elif key == ord("p"):
                self._mode = "point"
                self._current_points = []
                print("[modo] Ponto de referencia — clique uma vez para marcar.")
                self._render()
            elif key == ord("u"):
                if self._current_points:
                    removed = self._current_points.pop()
                    print(f"  Ponto removido: {removed}")
                    self._render()
            elif key == 13:
                if self._mode == "zone":
                    self._finalize_zone()
                elif self._mode == "point":
                    self._finalize_point()
                self._render()
            elif key == ord("r"):
                self._current_points = []
                print("[resetado] Pontos atuais limpos.")
                self._render()
            elif key == ord("s"):
                self.config.save(self.output_path)
                print(f"[salvo] {self.output_path}")

        cv2.destroyAllWindows()
