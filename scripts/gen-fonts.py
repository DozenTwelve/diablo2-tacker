# Cut the two web fonts (SIL OFL, from github.com/google/fonts) down to the characters the app uses, into src/fonts/.
# Google Fonts serves Noto Serif SC in ~100 slices and the item names touch most of them (5 MB on the uniques page);
# the cut font is one file of about 800 kB. Rerun after new Chinese text (game data or UI strings) lands.
# Usage: pip install fonttools brotli; python3 scripts/gen-fonts.py [--check]
#   --check: only list characters in src/ that the cut font lacks (exit 1 if any)
import glob, os, sys, tempfile, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "fonts")
SC = os.path.join(OUT, "noto-serif-sc.woff2")
GOOGLE = "https://github.com/google/fonts/raw/main/ofl/"

text = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "src", "**", "*.js*"), recursive=True))
chars = {c for c in text if ord(c) > 0x7F}


def fetch(path):
    local = os.path.join(tempfile.gettempdir(), os.path.basename(path))
    if not os.path.exists(local):
        urllib.request.urlretrieve(GOOGLE + path, local)
    return local


SC_SOURCE = fetch("notoserifsc/NotoSerifSC%5Bwght%5D.ttf")
if "--check" in sys.argv:
    # Characters Noto Serif SC never had (Korean, a few symbols) fall back to other fonts either way
    cut_cmap, source_cmap = TTFont(SC).getBestCmap(), TTFont(SC_SOURCE).getBestCmap()
    missing = "".join(sorted(c for c in chars if ord(c) in source_cmap and ord(c) not in cut_cmap))
    print(f"missing from {os.path.relpath(SC, ROOT)}: {missing}" if missing else "font has every character")
    sys.exit(1 if missing else 0)


def cut(font, unicodes, out, axes=None):
    # name_IDs: keep every name record, so the OFL notice stays in the font
    sub = subset.Subsetter(subset.Options(layout_features=["*"], name_IDs=["*"], flavor="woff2"))
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    if axes:
        font = instancer.instantiateVariableFont(font, axes)
    font.flavor = "woff2"
    font.save(out)
    print(os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, "kB")


ascii_ = range(0x20, 0x7F)
# The app uses weights 400 to 700; keeping only that part of the axis makes the file a little smaller
cut(TTFont(SC_SOURCE), [*ascii_, *map(ord, chars)], SC, {"wght": (400, 700)})
cut(TTFont(fetch("cinzeldecorative/CinzelDecorative-Regular.ttf")), [*ascii_, *range(0xA0, 0x100)], os.path.join(OUT, "cinzel-decorative.woff2"))
