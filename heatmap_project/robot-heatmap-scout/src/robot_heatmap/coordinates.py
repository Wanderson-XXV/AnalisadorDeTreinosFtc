def image_to_field(
    img_x: float,
    img_y: float,
    img_width: int,
    img_height: int,
    field_width: int = 1000,
    field_height: int = 1000,
) -> list:
    fx = round((img_x / img_width) * field_width)
    fy = round((img_y / img_height) * field_height)
    return [fx, fy]


def field_to_image(
    field_x: float,
    field_y: float,
    img_width: int,
    img_height: int,
    field_width: int = 1000,
    field_height: int = 1000,
) -> tuple:
    ix = int((field_x / field_width) * img_width)
    iy = int((field_y / field_height) * img_height)
    return (ix, iy)


class Coordinates:
    def __init__(self, img_width: int, img_height: int, field_width: int = 1000, field_height: int = 1000):
        self.img_width = img_width
        self.img_height = img_height
        self.field_width = field_width
        self.field_height = field_height

    def to_field(self, img_x: float, img_y: float) -> list:
        return image_to_field(img_x, img_y, self.img_width, self.img_height, self.field_width, self.field_height)

    def to_image(self, field_x: float, field_y: float) -> tuple:
        return field_to_image(field_x, field_y, self.img_width, self.img_height, self.field_width, self.field_height)
