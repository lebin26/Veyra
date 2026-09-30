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
        $pathOnly = $rawUrl.Split('?')[0]

        # -------------------------------------------------------------
        # Handle /api/ Local Mock Endpoints (Zero-setup local testing)
        # -------------------------------------------------------------
        if ($pathOnly.StartsWith("/api/")) {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 204
                $response.OutputStream.Close()
                continue
            }

            if ($pathOnly -eq "/api/auth/login" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyStr = $reader.ReadToEnd()
                $jsonBody = ConvertFrom-Json $bodyStr
                $id = if ($jsonBody.identifier) { $jsonBody.identifier.Trim() } else { "" }
                $pwd = if ($jsonBody.password) { $jsonBody.password } else { "" }

                if (($id -eq "lebin26" -or $id -eq "lebin26@veyra.app") -and $pwd -eq "12141214@Aa") {
                    $resObj = @{
                        success = $true
                        token = "local_admin_token_lebin26"
                        user = @{ id = "usr_admin_lebin26"; email = "lebin26@veyra.app" }
                        profile = @{
                            id = "usr_admin_lebin26"
                            username = "lebin26"
                            email = "lebin26@veyra.app"
                            display_name = "lebin26"
                            role = "admin"
                            status = "active"
                            plan_id = "pro"
                            must_change_password = 0
                        }
                        mustChangePassword = $false
                    }
                    $responseBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj))
                    $response.StatusCode = 200
                    $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                } else {
                    $errObj = @{ success = $false; error = "Invalid email or password" }
                    $responseBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $errObj))
                    $response.StatusCode = 401
                    $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                }
                $response.OutputStream.Close()
                continue
            }
            elseif ($pathOnly -eq "/api/auth/me" -and $request.HttpMethod -eq "GET") {
                $authH = $request.Headers["Authorization"]
                if ($authH -like "*local_admin_token_lebin26*") {
                    $resObj = @{
                        user = @{ id = "usr_admin_lebin26"; email = "lebin26@veyra.app" }
                        profile = @{
                            id = "usr_admin_lebin26"
                            username = "lebin26"
                            email = "lebin26@veyra.app"
                            display_name = "lebin26"
                            role = "admin"
                            status = "active"
                            plan_id = "pro"
                            must_change_password = 0
                        }
                    }
                } else {
                    $resObj = @{ user = $null; profile = $null }
                }
                $responseBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj))
                $response.StatusCode = 200
                $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                $response.OutputStream.Close()
                continue
            }
            elseif ($pathOnly -eq "/api/auth/logout") {
                $resObj = @{ success = $true }
                $responseBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj))
                $response.StatusCode = 200
                $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                $response.OutputStream.Close()
                continue
            }
        }

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
