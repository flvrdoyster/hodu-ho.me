#!/usr/bin/env bash
# 갤러리 이미지 일괄 처리: 리사이즈(긴 변 최대 1440px, 축소만) + WebP 변환
# 사용법: bash scripts/process-gallery.sh
# 입력: originals/  (jpg/jpeg/png/heic/tiff/webp)
# 출력: wedding/assets/gallery/gallery-01.webp ...
set -euo pipefail

SRC="originals"
OUT="wedding/assets/gallery"
MAX=1440
Q=82

mkdir -p "$OUT"
rm -f "$OUT"/gallery-*.webp   # 재실행 시 깨끗하게

i=0
while IFS= read -r -d '' f; do
  i=$((i + 1))
  n=$(printf "%02d" "$i")
  out="$OUT/gallery-$n.webp"

  w=$(sips -g pixelWidth  "$f" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
  long=$(( w > h ? w : h ))

  ext_lc=$(printf '%s' "${f##*.}" | tr 'A-Z' 'a-z')
  src="$f"; tmp=""
  # cwebp는 HEIC/TIFF를 못 읽으니 PNG로 선변환
  if [ "$ext_lc" = "heic" ] || [ "$ext_lc" = "tiff" ] || [ "$ext_lc" = "tif" ]; then
    tmp="$(mktemp).png"
    sips -s format png "$f" --out "$tmp" >/dev/null
    src="$tmp"
  fi

  # 축소만 (긴 변이 MAX 초과일 때만)
  rs=()
  if [ "$long" -gt "$MAX" ]; then
    if [ "$w" -ge "$h" ]; then rs=(-resize "$MAX" 0); else rs=(-resize 0 "$MAX"); fi
  fi

  cwebp -quiet -q "$Q" "${rs[@]}" "$src" -o "$out"
  [ -n "$tmp" ] && rm -f "$tmp"
  echo "→ $out  ←  $(basename "$f")  (${w}x${h})"
done < <(find "$SRC" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' -o -iname '*.tiff' -o -iname '*.tif' -o -iname '*.webp' \) \
  -print0 | sort -z)

echo "완료: ${i}장 → $OUT"
