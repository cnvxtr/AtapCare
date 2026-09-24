$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
# Sesuaikan dengan skema warna AtapCare: latar launcher = #0A0A0A (foreground/neutral-950)
$bg = [System.Drawing.Color]::FromArgb(255, 0x0A, 0x0A, 0x0A)

$root       = "C:\projekweb\AtapCare-main"
$logoPath   = "$root\src\assets\logo.png"
$resBase    = "$root\android\app\src\main\res"

$logo = [System.Drawing.Image]::FromFile($logoPath)
Write-Output "Logo: $($logo.Width)x$($logo.Height)"

function Save-Scaled {
    param($srcImage, $dest, $size, $fit = 0.78)
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear($bg)
    $pad = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    $rect = [System.Drawing.Rectangle]::new(0, 0, 0, 0)
    $pad = [int]($size * (1.0 - $fit))
    $rect = [System.Drawing.Rectangle]::new($pad, $pad, [int]($size * $fit), [int]($size * $fit))
    $g.DrawImage($srcImage, $rect)
    $g.Dispose()
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "  -> $dest ($size px)"
}

# 1) Legacy icons (full-bleed, logo 78% + bg)
$legacy = @(
    @{ d = "mipmap-mdpi";    px = 48 },
    @{ d = "mipmap-hdpi";    px = 72 },
    @{ d = "mipmap-xhdpi";   px = 96 },
    @{ d = "mipmap-xxhdpi";  px = 144 },
    @{ d = "mipmap-xxxhdpi"; px = 192 }
)
foreach ($l in $legacy) {
    $dir = "$resBase\$($l.d)"
    Save-Scaled $logo "$dir\ic_launcher.png"           $l.px
    Save-Scaled $logo "$dir\ic_launcher_round.png"     $l.px
}

# 2) Adaptive foreground (harus >= 2x legacy, logo ~55% di safe zone tengah)
$fore = @(
    @{ d = "mipmap-mdpi";    px = 108 },
    @{ d = "mipmap-hdpi";    px = 162 },
    @{ d = "mipmap-xhdpi";   px = 216 },
    @{ d = "mipmap-xxhdpi";  px = 324 },
    @{ d = "mipmap-xxxhdpi"; px = 432 }
)
foreach ($f in $fore) {
    $dir = "$resBase\$($f.d)"
    $pad = [int]($f.px * 0.22)
    $bmp = [System.Drawing.Bitmap]::new($f.px, $f.px)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $rect = [System.Drawing.Rectangle]::new($pad, $pad, $f.px - $pad * 2, $f.px - $pad * 2)
    $g.DrawImage($logo, $rect)
    $g.Dispose()
    $bmp.Save("$dir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "  -> $dir\ic_launcher_foreground.png ($($f.px) px)"
}

$logo.Dispose()
Write-Output "== SELESAI =="