from pathlib import Path
import re

repo = Path(__file__).resolve().parents[2]
public = repo / "web" / "public"
drawable = repo / "android" / "app" / "src" / "main" / "res" / "drawable"


def vector_from_svg(source: str, target: str, width: int, height: int) -> None:
    raw = (public / source).read_text(encoding="utf-8")
    x, y, view_width, view_height = map(float, re.search(r'viewBox="([^"]+)"', raw).group(1).split())
    paths = re.findall(r'<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"/>', raw)
    body = "\n".join(
        f'    <path android:fillColor="{fill}" android:fillType="evenOdd" android:pathData="{data}" />'
        for fill, data in paths
    )
    xml = (
        '<vector xmlns:android="http://schemas.android.com/apk/res/android" '
        f'android:width="{width}dp" android:height="{height}dp" '
        f'android:viewportWidth="{view_width:g}" android:viewportHeight="{view_height:g}">\n'
        f'  <group android:translateX="{-x:g}" android:translateY="{-y:g}">\n'
        f'{body}\n  </group>\n</vector>\n'
    )
    (drawable / target).write_text(xml, encoding="utf-8")


def square_symbol(target: str, size: int, mark_width: float) -> None:
    raw = (public / "onward-symbol.svg").read_text(encoding="utf-8")
    paths = re.findall(r'<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"/>', raw)
    scale = mark_width / 339.0
    mark_height = 241.0 * scale
    left = (size - mark_width) / 2.0
    top = (size - mark_height) / 2.0

    def transform(data: str) -> str:
        def point(match: re.Match[str]) -> str:
            command, x, y = match.groups()
            nx = (float(x) - 76.0) * scale + left
            ny = (float(y) - 233.0) * scale + top
            return f"{command}{nx:.3f},{ny:.3f}"
        return re.sub(r'([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', point, data)

    body = "\n".join(
        f'  <path android:fillColor="{fill}" android:fillType="evenOdd" android:pathData="{transform(data)}" />'
        for fill, data in paths
    )
    xml = (
        '<vector xmlns:android="http://schemas.android.com/apk/res/android" '
        f'android:width="{size}dp" android:height="{size}dp" '
        f'android:viewportWidth="{size}" android:viewportHeight="{size}">\n{body}\n</vector>\n'
    )
    (drawable / target).write_text(xml, encoding="utf-8")


vector_from_svg("onward-symbol.svg", "ic_onward.xml", 100, 71)
vector_from_svg("onward-lockup.svg", "ic_onward_lockup.xml", 156, 27)
square_symbol("onward_launcher_foreground.xml", 108, 66.0)
square_symbol("onward_splash.xml", 100, 62.0)
(public / "onward-icon.svg").write_text((public / "onward-symbol.svg").read_text(encoding="utf-8"), encoding="utf-8")
print("Generated Android lockup/symbol/launcher/splash vectors and legacy SVG alias from canonical Onward assets.")
