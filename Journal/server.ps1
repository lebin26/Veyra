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

$localAdminUser = if ($env:ADMIN_USERNAME) { $env:ADMIN_USERNAME } else { "admin" }
$localAdminPass = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { "admin" }

$localUsersList = [System.Collections.ArrayList]@(
    @{
        id = "usr_local_admin"
        username = $localAdminUser
        email = "$localAdminUser@veyra.app"
        display_name = $localAdminUser
        role = "admin"
        status = "active"
        plan_id = "pro"
        password = $localAdminPass
        must_change_password = 0
        created_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        app_overrides = @{
            trading_journal = $true
            wealth_tracker = $true
        }
    },
    @{
        id = "usr_lebin26"
        username = "lebin26"
        email = "lebin2626@gmail.com"
        display_name = "Lebin"
        role = "admin"
        status = "active"
        plan_id = "pro"
        password = $localAdminPass
        must_change_password = 0
        created_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        app_overrides = @{
            trading_journal = $true
            wealth_tracker = $true
        }
    }
)

# User-isolated in-memory storage for zero-bleed local development
$localWealthStores = @{}  # userId -> @{ month -> [ArrayList]@() }

function Get-UserFromAuthHeader($req, $users) {
    $authH = $req.Headers["Authorization"]
    if (-not $authH) { return $null }
    if ($authH -match "local_token_([a-zA-Z0-9_\-]+)") {
        $tid = $matches[1]
        return ($users | Where-Object { $_.id -eq $tid } | Select-Object -First 1)
    }
    if ($authH -like "*local_admin_token*") {
        return ($users | Where-Object { $_.id -eq "usr_local_admin" } | Select-Object -First 1)
    }
    return $null
}

function Send-JsonResponse($res, $code, $obj) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $obj -Depth 10))
    $res.StatusCode = $code
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
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
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 204
                $response.OutputStream.Close()
                continue
            }

            if ($pathOnly -eq "/api/auth/login" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyStr = $reader.ReadToEnd()
                $jsonBody = ConvertFrom-Json $bodyStr
                $id = if ($jsonBody.identifier) { $jsonBody.identifier.Trim().ToLower() } else { "" }
                $pwd = if ($jsonBody.password) { $jsonBody.password } else { "" }

                $matchedUser = $null
                foreach ($u in $localUsersList) {
                    $uNameLower = if ($u.username) { $u.username.ToLower() } else { "" }
                    $uEmailLower = if ($u.email) { $u.email.ToLower() } else { "" }
                    if ($uNameLower -eq $id -or $uEmailLower -eq $id) {
                        # Match password or allow local test pass
                        if ($pwd -eq $localAdminPass -or ($u.password -and $pwd -eq $u.password) -or $pwd -eq "VeyraTemp123!") {
                            $matchedUser = $u
                            break
                        }
                    }
                }

                if ($matchedUser) {
                    $token = "local_token_" + $matchedUser.id
                    $resObj = @{
                        success = $true
                        token = $token
                        user = @{ id = $matchedUser.id; email = $matchedUser.email; username = $matchedUser.username }
                        profile = @{
                            id = $matchedUser.id
                            username = $matchedUser.username
                            email = $matchedUser.email
                            display_name = $matchedUser.display_name
                            role = $matchedUser.role
                            status = $matchedUser.status
                            plan_id = $matchedUser.plan_id
                            must_change_password = $matchedUser.must_change_password
                            app_overrides = $matchedUser.app_overrides
                        }
                        mustChangePassword = ($matchedUser.must_change_password -eq 1)
                    }
                    Send-JsonResponse $response 200 $resObj
                } else {
                    $errObj = @{ success = $false; error = "Invalid email or password" }
                    Send-JsonResponse $response 401 $errObj
                }
                continue
            }
            elseif ($pathOnly -eq "/api/auth/me" -and $request.HttpMethod -eq "GET") {
                $targetU = Get-UserFromAuthHeader $request $localUsersList
                if ($targetU) {
                    $resObj = @{
                        user = @{ id = $targetU.id; email = $targetU.email; username = $targetU.username }
                        profile = @{
                            id = $targetU.id
                            username = $targetU.username
                            email = $targetU.email
                            display_name = $targetU.display_name
                            role = $targetU.role
                            status = $targetU.status
                            plan_id = $targetU.plan_id
                            must_change_password = $targetU.must_change_password
                            app_overrides = $targetU.app_overrides
                        }
                    }
                } else {
                    $resObj = @{ user = $null; profile = $null }
                }
                Send-JsonResponse $response 200 $resObj
                continue
            }
            elseif ($pathOnly -eq "/api/auth/logout") {
                $resObj = @{ success = $true }
                Send-JsonResponse $response 200 $resObj
                continue
            }
            elseif ($pathOnly -eq "/api/admin/users") {
                if ($request.HttpMethod -eq "GET") {
                    $resObj = @{ users = $localUsersList }
                    Send-JsonResponse $response 200 $resObj
                }
                elseif ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyStr = $reader.ReadToEnd()
                    $jsonBody = ConvertFrom-Json $bodyStr
                    $newU = @{
                        id = "usr_" + [System.Guid]::NewGuid().ToString().Replace("-","").Substring(0, 16)
                        username = if ($jsonBody.username) { $jsonBody.username } else { "user_" + (Get-Random) }
                        email = if ($jsonBody.email) { $jsonBody.email } else { $jsonBody.username + "@veyra.app" }
                        role = if ($jsonBody.role) { $jsonBody.role } else { "user" }
                        status = "active"
                        plan_id = if ($jsonBody.plan_id) { $jsonBody.plan_id } else { "pro" }
                        password = if ($jsonBody.password) { $jsonBody.password } else { "VeyraTemp123!" }
                        must_change_password = if ($jsonBody.must_change_password) { 1 } else { 0 }
                        created_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                        app_overrides = if ($jsonBody.app_overrides) { $jsonBody.app_overrides } else { @{} }
                    }
                    [void]$localUsersList.Add($newU)
                    $resObj = @{
                        success = $true
                        userId = $newU.id
                        username = $newU.username
                        initialPassword = $newU.password
                    }
                    Send-JsonResponse $response 200 $resObj
                }
                elseif ($request.HttpMethod -eq "PATCH") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyStr = $reader.ReadToEnd()
                    $jsonBody = ConvertFrom-Json $bodyStr
                    $target = $localUsersList | Where-Object { $_.id -eq $jsonBody.userId }
                    if ($target) {
                        # Sole admin protection
                        $activeAdmins = @($localUsersList | Where-Object { $_.role -eq "admin" -and $_.status -eq "active" })
                        if ($target.role -eq "admin" -and $activeAdmins.Count -le 1 -and (($jsonBody.status -eq "suspended") -or ($jsonBody.role -eq "user"))) {
                            $errObj = @{ success = $false; error = "Cannot suspend or demote the only active administrator" }
                            Send-JsonResponse $response 400 $errObj
                            continue
                        }
                        if ($jsonBody.username) {
                            $target.username = $jsonBody.username.Trim().ToLower()
                            $target.display_name = $jsonBody.username.Trim()
                        }
                        if ($jsonBody.email) { $target.email = $jsonBody.email.Trim().ToLower() }
                        if ($jsonBody.status) { $target.status = $jsonBody.status }
                        if ($jsonBody.role) { $target.role = $jsonBody.role }
                        if ($jsonBody.plan_id) { $target.plan_id = $jsonBody.plan_id }
                        if ($jsonBody.app_overrides) {
                            if (-not $target.app_overrides) { $target.app_overrides = @{} }
                            if ($null -ne $jsonBody.app_overrides.trading_journal) {
                                $target.app_overrides["trading_journal"] = $jsonBody.app_overrides.trading_journal
                            }
                            if ($null -ne $jsonBody.app_overrides.wealth_tracker) {
                                $target.app_overrides["wealth_tracker"] = $jsonBody.app_overrides.wealth_tracker
                            }
                        }
                    }
                    $resObj = @{ success = $true }
                    Send-JsonResponse $response 200 $resObj
                }
                continue
            }
            # ---------------------------------------------------------
            # Wealth Endpoints (Per-User Partitioned)
            # ---------------------------------------------------------
            elseif ($pathOnly.StartsWith("/api/wealth/")) {
                $targetU = Get-UserFromAuthHeader $request $localUsersList
                if (-not $targetU) {
                    Send-JsonResponse $response 401 @{ unauthorized = $true; error = "Unauthorized" }
                    continue
                }

                $uid = $targetU.id
                if (-not $localWealthStores.ContainsKey($uid)) {
                    $localWealthStores[$uid] = @{}
                }
                $userStore = $localWealthStores[$uid]

                # Parse month query param
                $m = "2026-10"
                if ($rawUrl -match "month=([^&]+)") {
                    $m = [System.Uri]::UnescapeDataString($matches[1])
                }

                if (-not $userStore.ContainsKey($m)) {
                    $userStore[$m] = [System.Collections.ArrayList]@()
                }
                $accountsList = $userStore[$m]

                if ($pathOnly -eq "/api/wealth/summary") {
                    $usdRate = 4.08
                    $totalNetWorthMyr = 0.0
                    $totalAprMyr = 0.0
                    $computed = @()
                    foreach ($a in $accountsList) {
                        $amt = [double]$a.amount
                        $apr = [double]$a.apr
                        $r = if ($a.currency -eq "USD") { $usdRate } else { 1.0 }
                        $myr = [Math]::Round(($amt * $r), 2)
                        $aprAmt = [Math]::Round((($myr * $apr) / 100.0), 2)
                        $totalNetWorthMyr += $myr
                        $totalAprMyr += $aprAmt
                        $computed += @{
                            id = $a.id
                            name = $a.name
                            category = $a.category
                            platform = $a.platform
                            currency = $a.currency
                            amount = $amt
                            apr = $apr
                            amount_myr = $myr
                            apr_amount_myr = $aprAmt
                        }
                    }
                    $weightedRoi = if ($totalNetWorthMyr -gt 0) { [Math]::Round((($totalAprMyr / $totalNetWorthMyr) * 100.0), 2) } else { 0.0 }
                    $allMonths = @($userStore.Keys | Sort-Object)

                    $resObj = @{
                        month = $m
                        is_archived = $false
                        needs_init = ($accountsList.Count -eq 0)
                        usd_rate = $usdRate
                        available_months = $allMonths
                        last_recorded_month = $null
                        portfolio = @{
                            total_net_worth_myr = $totalNetWorthMyr
                            estimated_apr_myr = $totalAprMyr
                            weighted_roi = $weightedRoi
                            accounts_count = $accountsList.Count
                            accounts = $computed
                        }
                        growth = @{
                            delta_rm = 0.0
                            growth_rate = 0.0
                            previous_month = $null
                            previous_net_worth = 0.0
                        }
                        analytics = @{
                            category_breakdown = @()
                            platform_breakdown = @()
                            history_snapshots = @()
                        }
                        insights = @{
                            top_apr_contributors = @()
                        }
                    }
                    Send-JsonResponse $response 200 $resObj
                    continue
                }
                elseif ($pathOnly -eq "/api/wealth/portfolio") {
                    if ($request.HttpMethod -eq "GET") {
                        Send-JsonResponse $response 200 @{ month = $m; accounts = $accountsList; usd_rate = 4.08 }
                    }
                    elseif ($request.HttpMethod -eq "POST") {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $bodyStr = $reader.ReadToEnd()
                        $b = ConvertFrom-Json $bodyStr
                        $newAcc = @{
                            id = "acc_" + [System.Guid]::NewGuid().ToString().Replace("-","").Substring(0, 10)
                            name = if ($b.name) { $b.name } else { "Account" }
                            category = if ($b.category) { $b.category } else { "bank" }
                            platform = if ($b.platform) { $b.platform } else { "Other" }
                            currency = if ($b.currency) { $b.currency } else { "MYR" }
                            amount = [double]$b.amount
                            apr = [double]$b.apr
                        }
                        [void]$accountsList.Add($newAcc)
                        Send-JsonResponse $response 201 @{ success = $true; account = $newAcc }
                    }
                    continue
                }
                elseif ($pathOnly.StartsWith("/api/wealth/portfolio/")) {
                    $accId = $pathOnly.Substring("/api/wealth/portfolio/".Length)
                    if ($request.HttpMethod -eq "DELETE") {
                        $toRemove = $accountsList | Where-Object { $_.id -eq $accId }
                        if ($toRemove) { [void]$accountsList.Remove($toRemove) }
                        Send-JsonResponse $response 200 @{ success = $true; deleted = $true }
                    }
                    elseif ($request.HttpMethod -eq "PUT") {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $bodyStr = $reader.ReadToEnd()
                        $b = ConvertFrom-Json $bodyStr
                        $item = $accountsList | Where-Object { $_.id -eq $accId }
                        if ($item) {
                            if ($b.name) { $item.name = $b.name }
                            if ($b.category) { $item.category = $b.category }
                            if ($b.platform) { $item.platform = $b.platform }
                            if ($b.currency) { $item.currency = $b.currency }
                            if ($null -ne $b.amount) { $item.amount = [double]$b.amount }
                            if ($null -ne $b.apr) { $item.apr = [double]$b.apr }
                        }
                        Send-JsonResponse $response 200 @{ success = $true; id = $accId }
                    }
                    continue
                }
                elseif ($pathOnly -eq "/api/wealth/settings") {
                    Send-JsonResponse $response 200 @{ success = $true }
                    continue
                }
            }
            elseif ($pathOnly.StartsWith("/api/journal/") -or $pathOnly -eq "/api/trades" -or $pathOnly.StartsWith("/api/trades/")) {
                $resObj = @{ success = $true }
                if ($pathOnly -eq "/api/journal/playbooks") {
                    $resObj = @{ playbooks = @() }
                } elseif ($pathOnly -eq "/api/journal/notebook") {
                    $resObj = @{ notes = @() }
                } elseif ($pathOnly -eq "/api/journal/goals") {
                    $resObj = @{ goals = @() }
                } elseif ($pathOnly -eq "/api/journal/broker-sync") {
                    $resObj = @{ brokers = @() }
                } elseif ($pathOnly -eq "/api/journal/daily") {
                    $resObj = @{ entries = @(); entry = $null }
                } elseif ($pathOnly -eq "/api/trades") {
                    $resObj = @{ trades = @() }
                }
                Send-JsonResponse $response 200 $resObj
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
