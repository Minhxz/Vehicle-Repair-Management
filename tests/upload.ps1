param([string]$BaseUrl = 'http://localhost:5251')
$ErrorActionPreference = 'Stop'
# Run only against the separate smoke-test app/database, never a live deployment.
Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.CookieContainer = [System.Net.CookieContainer]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.BaseAddress = [Uri]($BaseUrl.TrimEnd('/') + '/')
$uploadedUrl = $null
function Refresh-Csrf {
    $response = $client.GetAsync('api/auth/csrf').GetAwaiter().GetResult()
    $null = $response.EnsureSuccessStatusCode()
    $token = ($response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json).token
    $null = $client.DefaultRequestHeaders.Remove('X-CSRF-TOKEN')
    $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', $token)
    $response.Dispose()
}
function Send-Image([byte[]]$Bytes, [int]$Expected) {
    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $content = [System.Net.Http.ByteArrayContent]::new($Bytes)
    $multipart.Add($content, 'image', 'test.jpg')
    try {
        $response = $client.PostAsync('api/services/image', $multipart).GetAwaiter().GetResult()
        try {
            if ([int]$response.StatusCode -ne $Expected) { throw "Upload expected $Expected; received $([int]$response.StatusCode)." }
            return ($response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json)
        } finally { $response.Dispose() }
    } finally { $multipart.Dispose() }
}
try {
    Refresh-Csrf
    $login = [System.Net.Http.StringContent]::new('{"username":"admin","password":"123"}', [Text.Encoding]::UTF8, 'application/json')
    $response = $client.PostAsync('api/auth/login', $login).GetAwaiter().GetResult()
    $null = $response.EnsureSuccessStatusCode()
    $response.Dispose(); $login.Dispose()
    Refresh-Csrf
    $projectRoot = Split-Path $PSScriptRoot -Parent
    $photoPath = Join-Path $projectRoot 'wwwroot\images\workshop-detail.jpg'
    $result = Send-Image ([IO.File]::ReadAllBytes($photoPath)) 200
    $uploadedUrl = $result.imageUrl
    if ($uploadedUrl -notmatch '^/uploads/services/[a-f0-9]{32}\.jpg$') { throw 'Unexpected uploaded image URL.' }
    Write-Output 'PASS Valid JPEG upload returns a generated filename'
    $imageResponse = $client.GetAsync($uploadedUrl).GetAwaiter().GetResult()
    $null = $imageResponse.EnsureSuccessStatusCode()
    if ($imageResponse.Content.Headers.ContentType.MediaType -ne 'image/jpeg') { throw 'Uploaded image has an incorrect content type.' }
    $imageResponse.Dispose()
    Write-Output 'PASS Uploaded image can be displayed through the website'
    $null = Send-Image ([Text.Encoding]::UTF8.GetBytes('This is not an image file.')) 400
    Write-Output 'PASS Non-image content is rejected'
    $large = [byte[]]::new(2 * 1024 * 1024 + 1)
    $large[0] = 255; $large[1] = 216; $large[2] = 255
    $null = Send-Image $large 400
    Write-Output 'PASS Image larger than 2 MB is rejected'
    Write-Output 'All 4 upload checks passed.'
} finally {
    $client.Dispose(); $handler.Dispose()
    if ($uploadedUrl -match '^/uploads/services/[a-f0-9]{32}\.jpg$') {
        $uploadRoot = [IO.Path]::GetFullPath((Join-Path (Split-Path $PSScriptRoot -Parent) 'wwwroot\uploads\services'))
        $testFile = [IO.Path]::GetFullPath((Join-Path $uploadRoot ([IO.Path]::GetFileName($uploadedUrl))))
        if ($testFile.StartsWith($uploadRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $testFile -ErrorAction SilentlyContinue
        }
    }
}
