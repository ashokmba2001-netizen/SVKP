<#
.SYNOPSIS
    High-performance native Windows HTTP Backend Server for Sri Vasavi Ammavari Temple Receipts.
    Runs on port 5000 without requiring Node.js or Python.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicDir = Join-Path $scriptDir "public"
$dbFile = Join-Path $scriptDir "database\donors.json"
$backupDir = Join-Path $scriptDir "backups"
$port = 5000
$prefix = "http://localhost:$port/"

# Ensure database directory exists
if (-not (Test-Path (Split-Path $dbFile -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $dbFile -Parent) -Force | Out-Null
}
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}
if (-not (Test-Path $dbFile)) {
    Set-Content -Path $dbFile -Value "[]" -Encoding UTF8
}

function Get-Donors {
    try {
        $content = [System.IO.File]::ReadAllText($dbFile, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($content)) { return @() }
        $data = $content | ConvertFrom-Json
        if ($null -eq $data) { return @() }
        if ($data -isnot [System.Array]) { return @($data) }
        return $data
    } catch {
        Write-Warning "Error reading donors: $_"
        return @()
    }
}

function Save-Donors ($donors) {
    try {
        $json = $donors | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($dbFile, $json, [System.Text.Encoding]::UTF8)

        # Automatic backup every save
        $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
        $backupFile = Join-Path $backupDir "donors_backup_$timestamp.json"
        [System.IO.File]::WriteAllText($backupFile, $json, [System.Text.Encoding]::UTF8)
        
        # Keep only the last 20 backups
        Get-ChildItem -Path $backupDir -Filter "donors_backup_*.json" | 
            Sort-Object CreationTime -Descending | 
            Select-Object -Skip 20 | 
            Remove-Item -Force -ErrorAction SilentlyContinue

        return $true
    } catch {
        Write-Error "Error saving donors: $_"
        return $false
    }
}

function Get-MimeType ($filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

function Send-Response ($response, $statusCode, $contentType, $contentBytes) {
    $response.StatusCode = $statusCode
    $response.ContentType = $contentType
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $response.ContentLength64 = $contentBytes.Length
    $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
    $response.OutputStream.Close()
}

function Send-JsonResponse ($response, $statusCode, $obj) {
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-Response $response $statusCode "application/json; charset=utf-8" $bytes
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Could not start server on $prefix. Ensure port $port is not in use. Error: $_"
    exit 1
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  SRI VASAVI AMMAVARI THADIYARADHANA SANGHAM - ONGOLE" -ForegroundColor Yellow
Write-Host "  Temple Receipt Management Web Server Running" -ForegroundColor Green
Write-Host "  URL: $prefix" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }

    $request = $context.Request
    $response = $context.Response
    $urlPath = $request.Url.LocalPath
    $method = $request.HttpMethod

    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $method $urlPath" -ForegroundColor DarkGray

    # CORS Preflight
    if ($method -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        $response.OutputStream.Close()
        continue
    }

    # API Routes
    if ($urlPath.StartsWith("/api/")) {
        try {
            if ($urlPath -eq "/api/donors" -and $method -eq "GET") {
                $donors = Get-Donors
                Send-JsonResponse $response 200 $donors
                continue
            }

            if ($urlPath -eq "/api/donors" -and $method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                
                $newDonor = $body | ConvertFrom-Json
                $donors = @(Get-Donors)

                # Determine next receipt number if not given
                if (-not $newDonor.receiptNo -or $newDonor.receiptNo -le 0) {
                    $maxNo = 26241
                    foreach ($d in $donors) {
                        if ($d.receiptNo -and [int]$d.receiptNo -gt $maxNo) {
                            $maxNo = [int]$d.receiptNo
                        }
                    }
                    $newDonor | Add-Member -NotePropertyName "receiptNo" -NotePropertyValue ($maxNo + 1) -Force
                }

                if (-not $newDonor.id) {
                    $newId = "rec-" + $newDonor.receiptNo
                    $newDonor | Add-Member -NotePropertyName "id" -NotePropertyValue $newId -Force
                }

                if (-not $newDonor.createdAt) {
                    $newDonor | Add-Member -NotePropertyName "createdAt" -NotePropertyValue ((Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")) -Force
                }

                $donors += $newDonor
                Save-Donors $donors | Out-Null
                Send-JsonResponse $response 201 $newDonor
                continue
            }

            if ($urlPath.StartsWith("/api/donors/") -and $method -eq "PUT") {
                $id = $urlPath.Substring("/api/donors/".Length)
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $updated = $body | ConvertFrom-Json
                $donors = @(Get-Donors)
                $newDonors = @()
                $found = $false

                foreach ($d in $donors) {
                    if ($d.id -eq $id -or $d.receiptNo.ToString() -eq $id) {
                        $newDonors += $updated
                        $found = $true
                    } else {
                        $newDonors += $d
                    }
                }

                if ($found) {
                    Save-Donors $newDonors | Out-Null
                    Send-JsonResponse $response 200 $updated
                } else {
                    Send-JsonResponse $response 404 @{ error = "Donor not found" }
                }
                continue
            }

            if ($urlPath.StartsWith("/api/donors/") -and $method -eq "DELETE") {
                $id = $urlPath.Substring("/api/donors/".Length)
                $donors = @(Get-Donors)
                $newDonors = @()
                $removed = $false

                foreach ($d in $donors) {
                    if ($d.id -eq $id -or $d.receiptNo.ToString() -eq $id) {
                        $removed = $true
                    } else {
                        $newDonors += $d
                    }
                }

                if ($removed) {
                    Save-Donors $newDonors | Out-Null
                    Send-JsonResponse $response 200 @{ success = $true; message = "Donor deleted" }
                } else {
                    Send-JsonResponse $response 404 @{ error = "Donor not found" }
                }
                continue
            }

            if ($urlPath -eq "/api/stats" -and $method -eq "GET") {
                $donors = @(Get-Donors)
                $totalAmount = 0
                $todayAmount = 0
                $todayStr = (Get-Date).ToString("yyyy-MM-dd")

                foreach ($d in $donors) {
                    $amt = [double]($d.amount -as [double])
                    $totalAmount += $amt
                    if ($d.date -eq $todayStr) {
                        $todayAmount += $amt
                    }
                }

                $stats = @{
                    totalDonors = $donors.Count
                    totalAmount = $totalAmount
                    todayAmount = $todayAmount
                    lastReceiptNo = if ($donors.Count -gt 0) { $donors[-1].receiptNo } else { 26242 }
                }
                Send-JsonResponse $response 200 $stats
                continue
            }

            if ($urlPath -eq "/api/export/csv" -and $method -eq "GET") {
                $donors = @(Get-Donors)
                $csvLines = @()
                $csvLines += "`"రసీదు నెం (Receipt No)`",`"తేది (Date)`",`"భక్తుని పేరు (Donor Name)`",`"ఫోన్ నెంబరు (Phone)`",`"గోత్రము (Gotram)`",`"చిరునామా (Address / Area)`",`"మొత్తం రూ. (Amount)`",`"అక్షరములు (Amount in Words)`",`"చెల్లింపు విధానం (Payment Mode)`",`"సంతకం (Signatory)`",`"గమనిక (Notes)`""
                
                foreach ($d in $donors) {
                    $rNo = "$($d.receiptNo)".Replace('"', '""')
                    $dt = "$($d.displayDate)".Replace('"', '""')
                    $nm = "$($d.name)".Replace('"', '""')
                    $ph = "$($d.phone)".Replace('"', '""')
                    $gt = "$($d.gotram)".Replace('"', '""')
                    $ar = "$($d.area)".Replace('"', '""')
                    $am = "$($d.amount)".Replace('"', '""')
                    $aw = "$($d.amountInWords)".Replace('"', '""')
                    $pm = "$($d.paymentMode)".Replace('"', '""')
                    $sg = "$($d.signature)".Replace('"', '""')
                    $nt = "$($d.notes)".Replace('"', '""')

                    $csvLines += "`"$rNo`",`"$dt`",`"$nm`",`"$ph`",`"$gt`",`"$ar`",`"$am`",`"$aw`",`"$pm`",`"$sg`",`"$nt`""
                }

                $csvContent = [string]::Join("`r`n", $csvLines)
                # Add UTF-8 BOM so Telugu characters open cleanly in Microsoft Excel!
                $bom = [System.Text.Encoding]::UTF8.GetPreamble()
                $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($csvContent)
                $fullBytes = New-Object byte[] ($bom.Length + $dataBytes.Length)
                [System.Buffer]::BlockCopy($bom, 0, $fullBytes, 0, $bom.Length)
                [System.Buffer]::BlockCopy($dataBytes, 0, $fullBytes, $bom.Length, $dataBytes.Length)

                $response.Headers.Add("Content-Disposition", "attachment; filename=Vasavi_Temple_Donations_$((Get-Date).ToString('yyyyMMdd')).csv")
                Send-Response $response 200 "text/csv; charset=utf-8" $fullBytes
                continue
            }

            if ($urlPath -eq "/api/import" -and $method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $imported = $body | ConvertFrom-Json
                if ($imported -isnot [System.Array]) { $imported = @($imported) }

                $donors = @(Get-Donors)
                $map = @{}
                foreach ($d in $donors) { $map["$($d.receiptNo)"] = $d }
                foreach ($imp in $imported) { $map["$($imp.receiptNo)"] = $imp }

                $merged = @($map.Values | Sort-Object { [int]$_.receiptNo })
                Save-Donors $merged | Out-Null
                Send-JsonResponse $response 200 @{ success = $true; count = $merged.Count }
                continue
            }

            # Unrecognized API
            Send-JsonResponse $response 404 @{ error = "Not Found" }
            continue
        } catch {
            Write-Error "API Error: $_"
            Send-JsonResponse $response 500 @{ error = "$_" }
            continue
        }
    }

    # Static File Handling
    $relPath = $urlPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = "index.html" }
    $localFile = [System.IO.Path]::GetFullPath((Join-Path $publicDir $relPath))

    # Security check: must reside inside public directory
    if (-not $localFile.StartsWith($publicDir, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-JsonResponse $response 403 @{ error = "Forbidden" }
        continue
    }

    if (Test-Path $localFile -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($localFile)
        $contentType = Get-MimeType $localFile
        Send-Response $response 200 $contentType $bytes
    } else {
        $response.StatusCode = 404
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
        Send-Response $response 404 "text/plain; charset=utf-8" $notFoundBytes
    }
}

$listener.Close()
