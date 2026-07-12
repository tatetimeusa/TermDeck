param([string]$emit = "", [switch]$png1024)

Add-Type -AssemblyName System.Drawing

$BG = [System.Drawing.Color]::FromArgb(255, 10, 14, 22)
$CYAN = [System.Drawing.Color]::FromArgb(255, 45, 212, 238)
$LIME = [System.Drawing.Color]::FromArgb(255, 163, 230, 53)
$MAG = [System.Drawing.Color]::FromArgb(255, 232, 121, 249)
$GREEN = [System.Drawing.Color]::FromArgb(255, 74, 222, 128)
$AMBER = [System.Drawing.Color]::FromArgb(255, 245, 176, 62)
$RED = [System.Drawing.Color]::FromArgb(255, 251, 113, 133)
$BORDER = [System.Drawing.Color]::FromArgb(255, 28, 41, 64)

function RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-Tile([int]$size, [string]$variant) {
  $s = $size / 256.0
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $glowText = {
    param($txt, $font, $x, $y, $col, $sf, $rad)
    # three shrinking rings so big renders (1024) read as a blur, not ghost copies
    foreach ($f in @(1.0, 0.66, 0.33)) {
      $r = [single]($rad * $f)
      $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, $col.R, $col.G, $col.B))
      foreach ($o in @(@(-$r, 0), @($r, 0), @(0, -$r), @(0, $r), @(-$r, -$r), @($r, $r), @(-$r, $r), @($r, -$r))) {
        $g.DrawString($txt, $font, $glow, [single]($x + $o[0]), [single]($y + $o[1]), $sf)
      }
      $glow.Dispose()
    }
    $solid = New-Object System.Drawing.SolidBrush $col
    $g.DrawString($txt, $font, $solid, [single]$x, [single]$y, $sf)
    $solid.Dispose()
  }
  $glowRect = {
    param($x, $y, $w, $h, $rad, $col)
    for ($k = 3; $k -ge 1; $k--) {
      $exp = [single]($k * 2.4 * $s)
      $gp = RoundedPath ($x - $exp) ($y - $exp) ($w + 2 * $exp) ($h + 2 * $exp) ($rad + $exp)
      $gb = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([int](24 / $k), $col.R, $col.G, $col.B))
      $g.FillPath($gb, $gp); $gb.Dispose(); $gp.Dispose()
    }
    $p = RoundedPath $x $y $w $h $rad
    $b = New-Object System.Drawing.SolidBrush $col
    $g.FillPath($b, $p); $b.Dispose(); $p.Dispose()
  }

  # ---- background tile + cyan glow border (all variants) ----
  $margin = [single](14 * $s)
  $rs = [single]($size - 2 * $margin)
  $radius = [single]([Math]::Min(50 * $s, $rs / 2))
  $tile = RoundedPath $margin $margin $rs $rs $radius
  $bgb = New-Object System.Drawing.SolidBrush $BG
  $g.FillPath($bgb, $tile)
  for ($i = 4; $i -ge 1; $i--) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb([int](28 / $i), 45, 212, 238)), ([single]($i * 3 * $s))
    $g.DrawPath($pen, $tile); $pen.Dispose()
  }
  $bp = New-Object System.Drawing.Pen $CYAN, ([single](3.2 * $s))
  $g.DrawPath($bp, $tile); $bp.Dispose()

  $sf = [System.Drawing.StringFormat]::GenericTypographic

  function Draw-Prompt($fontPx, $cy, $curCol) {
    $font = New-Object System.Drawing.Font("Consolas", [single]($fontPx * $s), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $gt = $g.MeasureString(">", $font, [int]0, $sf)
    $wGt = $gt.Width; $hGt = $gt.Height
    $cursorW = [single](($fontPx * 0.46) * $s)
    $cursorH = [single](($fontPx * 0.12) * $s)
    $gap = [single](($fontPx * 0.14) * $s)
    $totalW = $wGt + $gap + $cursorW
    $startX = ($size - $totalW) / 2.0
    $textY = $cy - $hGt / 2.0
    & $glowText ">" $font $startX $textY $CYAN $sf ([single](3.2 * $s))
    $curX = $startX + $wGt + $gap
    $curY = $cy + $hGt * 0.14
    & $glowRect $curX $curY $cursorW $cursorH ([single]($cursorH / 2)) $curCol
    $font.Dispose()
  }

  function Draw-Dots($dy, $dia) {
    $cols = @($CYAN, $MAG, $GREEN, $AMBER, $RED, $LIME)
    $dotD = [single]($dia * $s); $dotGap = [single](($dia * 0.9) * $s)
    $w = 6 * $dotD + 5 * $dotGap
    $x0 = ($size - $w) / 2.0
    for ($i = 0; $i -lt 6; $i++) {
      $b = New-Object System.Drawing.SolidBrush $cols[$i]
      $g.FillEllipse($b, [single]($x0 + $i * ($dotD + $dotGap)), [single]$dy, $dotD, $dotD); $b.Dispose()
    }
  }

  switch ($variant) {
    "A" {
      # minimal bold prompt, centered
      Draw-Prompt 120 ([single]($size * 0.46)) $LIME
    }
    "B" {
      # prompt + module-colour dot row
      Draw-Prompt 104 ([single]($size * 0.40)) $LIME
      Draw-Dots ([single]($size * 0.755)) 15
    }
    "C" {
      # terminal-window: title bar with dots + prompt in the screen
      $sm = [single](40 * $s)
      $sw = [single]($size - 2 * $sm)
      $scr = RoundedPath $sm $sm $sw $sw ([single](16 * $s))
      $scrB = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 13, 20, 34))
      $g.FillPath($scrB, $scr); $scrB.Dispose()
      $sp = New-Object System.Drawing.Pen $BORDER, ([single](2 * $s))
      $g.DrawPath($sp, $scr); $sp.Dispose()
      # title bar separator
      $barY = [single]($sm + 34 * $s)
      $lp = New-Object System.Drawing.Pen $BORDER, ([single](2 * $s))
      $g.DrawLine($lp, [single]($sm + 8 * $s), $barY, [single]($sm + $sw - 8 * $s), $barY); $lp.Dispose()
      # three window dots
      $td = [single](11 * $s)
      $tx = [single]($sm + 18 * $s); $ty = [single]($sm + 17 * $s - $td / 2)
      foreach ($pair in @(@($CYAN, 0), @($MAG, 1), @($LIME, 2))) {
        $b = New-Object System.Drawing.SolidBrush $pair[0]
        $g.FillEllipse($b, [single]($tx + $pair[1] * ($td + 8 * $s)), $ty, $td, $td); $b.Dispose()
      }
      # prompt inside screen
      Draw-Prompt 92 ([single]($size * 0.55)) $LIME
    }
  }

  $g.Dispose()
  return $bmp
}

$buildDir = "C:\Users\micha\TermDeck\build"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# -emit A -png1024 → one big PNG; the mac build turns it into icon.icns on a macOS runner
if ($png1024 -and $emit -ne "") {
  $b = New-Tile 1024 $emit
  $pngPath = "$buildDir\icon-1024.png"
  $b.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  "1024px PNG written for variant ${emit}: $pngPath"
}
elseif ($emit -ne "") {
  $sizes = @(256, 128, 64, 48, 32, 16)
  $pngs = @()
  foreach ($sz in $sizes) {
    $b = New-Tile $sz $emit
    $ms = New-Object System.IO.MemoryStream
    $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , ($ms.ToArray()); $ms.Dispose(); $b.Dispose()
  }
  $icoPath = "$buildDir\icon.ico"
  $fs = [System.IO.File]::Create($icoPath)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]; $wb = if ($sz -ge 256) { 0 } else { $sz }
    $bw.Write([byte]$wb); $bw.Write([byte]$wb); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]$pngs[$i].Length); $bw.Write([uint32]$offset)
    $offset += $pngs[$i].Length
  }
  foreach ($p in $pngs) { $bw.Write($p) }
  $bw.Flush(); $bw.Close(); $fs.Close()
  "ICO written for variant ${emit}: $icoPath"
}
else {
  foreach ($v in @("A", "B", "C")) {
    $b = New-Tile 256 $v
    $b.Save("$buildDir\variant$v.png", [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  }
  "previews written: variantA.png, variantB.png, variantC.png"
}
