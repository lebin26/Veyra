# server.ps1 - Zero-dependency minimal HTTP Static Server for Windows PowerShell
$port = 8080
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "VEYRA Local Server started at $prefix"
} catch {
    $port = 8081
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    Write-Host "VEYRA Local Server started at $prefix"
}

$parentDir = Split-Path -Parent $PSScriptRoot
if (Test-Path (Join-Path $parentDir "main-page\index.html")) {
    $baseDir = $parentDir
} else {
    $baseDir = $PSScriptRoot
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl
        if ($rawUrl -eq "/") {
            if (Test-Path (Join-Path $baseDir "index.html")) {
                $rawUrl = "/index.html"
            } elseif (Test-Path (Join-Path $baseDir "main-page\index.html")) {
                $rawUrl = "/main-page/index.html"
            } else {
                $rawUrl = "/index.html"
            }
        }
        $cleanPath = $rawUrl.Split('?')[0].TrimStart('/')
        $cleanPath = [System.Uri]::UnescapeDataString($cleanPath).Replace('/', '\')
        $filePath = Join-Path $baseDir $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".webp" { "image/webp" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.OutputStream.Close()
    } catch {
        # ignore client disconnect
    }
}
