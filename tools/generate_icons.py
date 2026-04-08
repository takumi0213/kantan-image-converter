# かんたん画像変換 - Browser extension to convert and save web images
# Copyright (C) 2026 takumi0213
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""Generate icons for かんたん画像変換 browser extension."""
from PIL import Image, ImageDraw

def create_icon(size: int) -> Image.Image:
    """Create an icon at the given size.
    
    Design: A rounded square with an image icon (mountain/sun) 
    and a conversion arrow, using a clean blue-teal gradient feel.
    """
    scale = size / 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded rectangle
    radius = int(24 * scale)
    bg_color = (41, 121, 194)  # Blue
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radius,
        fill=bg_color,
    )

    # Inner lighter area (image frame)
    margin = int(18 * scale)
    inner_radius = int(12 * scale)
    draw.rounded_rectangle(
        [margin, margin, size - margin - 1, size - margin - 1],
        radius=inner_radius,
        fill=(255, 255, 255, 230),
    )

    # Mountain shape (image icon metaphor)
    cx = size // 2
    cy = size // 2
    
    # Large mountain
    m1_base_y = int(cy + 18 * scale)
    m1_peak_y = int(cy - 12 * scale)
    m1_left = int(cx - 28 * scale)
    m1_right = int(cx + 12 * scale)
    m1_peak_x = int(cx - 10 * scale)
    draw.polygon(
        [(m1_left, m1_base_y), (m1_peak_x, m1_peak_y), (m1_right, m1_base_y)],
        fill=(76, 156, 106),
    )

    # Small mountain
    m2_left = int(cx - 4 * scale)
    m2_right = int(cx + 28 * scale)
    m2_peak_x = int(cx + 14 * scale)
    m2_peak_y = int(cy - 2 * scale)
    draw.polygon(
        [(m2_left, m1_base_y), (m2_peak_x, m2_peak_y), (m2_right, m1_base_y)],
        fill=(92, 184, 128),
    )

    # Sun
    sun_cx = int(cx + 16 * scale)
    sun_cy = int(cy - 20 * scale)
    sun_r = int(8 * scale)
    draw.ellipse(
        [sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
        fill=(255, 200, 60),
    )

    # Conversion arrow (bottom-right corner badge)
    badge_cx = int(size - 24 * scale)
    badge_cy = int(size - 24 * scale)
    badge_r = int(18 * scale)
    
    # Badge circle background
    draw.ellipse(
        [badge_cx - badge_r, badge_cy - badge_r,
         badge_cx + badge_r, badge_cy + badge_r],
        fill=(232, 89, 60),
    )
    
    # Arrow shape in badge (right-pointing with curved feel)
    arr_size = int(9 * scale)
    arrow_lw = max(int(3 * scale), 2)
    
    # Arrow stem
    draw.line(
        [(badge_cx - arr_size, badge_cy), (badge_cx + arr_size, badge_cy)],
        fill=(255, 255, 255),
        width=arrow_lw,
    )
    # Arrow head
    head_len = int(6 * scale)
    draw.line(
        [(badge_cx + arr_size - head_len, badge_cy - head_len),
         (badge_cx + arr_size, badge_cy)],
        fill=(255, 255, 255),
        width=arrow_lw,
    )
    draw.line(
        [(badge_cx + arr_size - head_len, badge_cy + head_len),
         (badge_cx + arr_size, badge_cy)],
        fill=(255, 255, 255),
        width=arrow_lw,
    )

    return img


if __name__ == "__main__":
    import os

    # プロジェクトルート基準で icons/ に出力する
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    icons_dir = os.path.join(project_root, "icons")
    os.makedirs(icons_dir, exist_ok=True)

    for s in [16, 48, 128]:
        icon = create_icon(s)
        path = os.path.join(icons_dir, f"icon{s}.png")
        icon.save(path)
        print(f"Generated {path}")
