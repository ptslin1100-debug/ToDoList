# start-server.ps1
# 適用於 Windows 的輕量級本地靜態 HTTP 伺服器 (供 TeamTask 協作待辦應用程式使用)

$port = 8080
$hostAddress = "http://localhost:$port/"
$baseDir = $PSScriptRoot
if (-not $baseDir) { $baseDir = Get-Location }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  TeamTask 協作待辦清單 - 本地開發伺服器" -ForegroundColor Green
Write-Host "  專案目錄: $baseDir" -ForegroundColor Gray
Write-Host "  伺服器網址: $hostAddress" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 啟動 HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($hostAddress)

try {
    $listener.Start()
} catch {
    Write-Warning "無法在連接埠 $port 啟動 (可能已被佔用)，嘗試連接埠 8088..."
    $port = 8088
    $hostAddress = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($hostAddress)
    $listener.Start()
}

Write-Host "伺服器正在運行中！正在為您開啟瀏覽器..." -ForegroundColor Green
Write-Host "按 Ctrl + C 即可停止伺服器。" -ForegroundColor Gray

# 自動開啟預設瀏覽器
Start-Process $hostAddress

# MIME 類型對應表
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "/index.html"
        }

        # 替換 URL 反斜線
        $relativePath = $urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::Combine($baseDir, $relativePath)

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            
            # 支援 CORS 與本地開發標頭
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }

        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`n伺服器已安全停止。" -ForegroundColor Yellow
}
