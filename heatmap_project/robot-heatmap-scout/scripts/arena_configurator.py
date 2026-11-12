import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.arena_editor import ArenaEditor
from robot_heatmap.field_config import FieldConfig, resolve_image_path


def parse_args():
    parser = argparse.ArgumentParser(description="Arena Configurator — Robot Heatmap Scout")
    parser.add_argument("--image", default=None, help="Caminho para imagem PNG/JPG da arena (top-down)")
    parser.add_argument("--output", required=True, help="Caminho para salvar o YAML de configuracao")
    parser.add_argument("--load", default=None, help="Caminho de YAML existente para reabrir")
    parser.add_argument("--unit", default="normalized", choices=["normalized", "cm"], help="Unidade logica do campo para YAML novo")
    parser.add_argument("--field-width", type=float, default=1000, help="Largura logica do campo para YAML novo")
    parser.add_argument("--field-height", type=float, default=1000, help="Altura logica do campo para YAML novo")
    return parser.parse_args()


def main():
    args = parse_args()

    image_path = args.image

    load_path = args.load
    if load_path and not os.path.isfile(load_path):
        print(f"[aviso] Arquivo --load nao encontrado: {load_path}. Iniciando sem dados salvos.")
        load_path = None

    if image_path is None and load_path:
        config = FieldConfig.from_file(load_path)
        image_path = resolve_image_path(load_path, config.field.get("image", ""), cwd=os.getcwd())

    if image_path is None:
        print("[erro] Informe --image ao criar uma configuracao nova, ou use --load para reabrir um YAML existente.")
        sys.exit(1)

    if not os.path.isfile(image_path):
        print(f"[erro] Imagem nao encontrada: {args.image}")
        print("Coloque a imagem PNG/JPG da arena em assets/arenas/ e passe o caminho via --image.")
        sys.exit(1)

    editor = ArenaEditor(
        image_path=image_path,
        output_path=args.output,
        load_path=load_path,
        unit=args.unit,
        field_width=args.field_width,
        field_height=args.field_height,
    )
    editor.run()


if __name__ == "__main__":
    main()
