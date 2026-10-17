#!/bin/sh
# Build the plugin zip, decky/out/d2r-collection-tracker.zip, to install from Decky's developer settings.
set -eu
cd "$(dirname "$0")"
NAME=d2r-collection-tracker
OUT=out/$NAME
rm -rf out
mkdir -p $OUT/bin
npm run build
(cd .. && VITE_DECK=1 npx vite build --outDir decky/$OUT/web --emptyOutDir)
# No Blizzard art in the zip: the plugin makes the icons from the player's own game files
rm -rf $OUT/web/items $OUT/web/_headers $OUT/web/_redirects
cp -R plugin.json package.json main.py py_modules dist $OUT/
rm -rf $OUT/py_modules/__pycache__

# casc-cli (MIT) reads the game files
CASC=casc-x86_64-unknown-linux-gnu
curl -sfL https://github.com/ironsp4rk/casc-cli/releases/download/v0.1.6/$CASC.tar.xz -o out/casc.tar.xz
echo "0684670ac8f938786d45586d79aeafdd0b205ab5d6cc75786ab094ef743c2b05  out/casc.tar.xz" | shasum -a 256 -c -
tar -xJf out/casc.tar.xz -C out
cp out/$CASC/casc $OUT/bin/casc
cp out/$CASC/LICENSE $OUT/bin/casc-LICENSE

(cd out && zip -qr $NAME.zip $NAME)
if unzip -l out/$NAME.zip | grep -qiE '\.(sprite|webp)$|/items/'; then
  echo "game art found in the zip" >&2
  exit 1
fi
echo "out/$NAME.zip"
