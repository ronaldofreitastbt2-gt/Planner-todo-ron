Add-Type -AssemblyName System.Drawing
$src = 'D:\Users\Ron HL300\Downloads\++Sistema Dev++\teste ZCode\Planner\planner-pwa-moderno\public\icons\LogoPlanner.png'
$outDir = 'D:\Users\Ron HL300\Downloads\++Sistema Dev++\teste ZCode\Planner\planner-pwa-moderno\public\icons'

$img = [System.Drawing.Image]::FromFile($src)
Write-Host "Source: $($img.Width)x$($img.Height)"

function Resize-Icon([int]$size, [string]$outName) {
  $outPath = Join-Path $outDir $outName
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $sz = (Get-Item $outPath).Length
  Write-Host "Created: $outName  size=${size}x${size}  bytes=$sz"
}

Resize-Icon 192 'icon-192x192.png'
Resize-Icon 512 'icon-512x512.png'
$img.Dispose()
Write-Host "Done!"
