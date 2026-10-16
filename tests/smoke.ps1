# Run only against an isolated Development app/test database, never the real project data.
# Example: powershell -NoProfile -File tests/smoke.ps1 -BaseUrl http://localhost:5251
# Start the app separately with AutoFix__ImportLegacyJson=false and a dedicated
# ConnectionStrings__AutoFix database such as AutoFixCompactSmoke_<unique>.
# This script does not start/stop processes or create/drop databases. Synthetic
# appointments remain in the test database because the app has no delete-booking API.
[CmdletBinding()]
param([string] $BaseUrl = 'http://localhost:5251')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$script:Checks = 0

function New-Client {
    return @{ Session = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Csrf = $null }
}

function Send-Api {
    param(
        [hashtable] $Client,
        [string] $Method,
        [string] $Path,
        [AllowNull()] $Payload = $null,
        [switch] $NoCsrf
    )
    # Invoke-WebRequest retains custom headers in WebRequestSession on PowerShell 5.1.
    # Clear the old token so -NoCsrf really sends a request without it.
    $null = $Client.Session.Headers.Remove('X-CSRF-TOKEN')
    $headers = @{}
    if ($Method -notin @('GET', 'HEAD', 'OPTIONS') -and -not $NoCsrf -and $Client.Csrf) {
        $headers['X-CSRF-TOKEN'] = $Client.Csrf
    }
    $parameters = @{
        Uri = $BaseUrl + $Path; Method = $Method; WebSession = $Client.Session
        Headers = $headers; UseBasicParsing = $true; ErrorAction = 'Stop'
    }
    if ($null -ne $Payload) {
        $parameters.ContentType = 'application/json; charset=utf-8'
        $parameters.Body = [Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 20 -Compress))
    }
    $status = 0
    $body = ''
    try {
        $response = Invoke-WebRequest @parameters
        $status = [int] $response.StatusCode
        $body = [string] $response.Content
    }
    catch {
        $response = if ($_.Exception.PSObject.Properties['Response']) { $_.Exception.Response } else { $null }
        if ($null -eq $response) { throw "Cannot reach test app: $Method $Path" }
        $status = [int] $response.StatusCode
        $body = if ($null -ne $_.ErrorDetails) { [string] $_.ErrorDetails.Message } else { '' }
        if (-not $body) {
            if ($response -is [System.Net.HttpWebResponse]) {
                $reader = New-Object IO.StreamReader($response.GetResponseStream())
                try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
            elseif ($null -ne $response.Content) {
                $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
        }
    }
    $json = $null
    if ($body) { try { $json = $body | ConvertFrom-Json } catch { } }
    return [pscustomobject] @{ Status = $status; Json = $json }
}

function Expect-Status {
    param($Response, [int] $Expected, [string] $Label)
    if ($Response.Status -ne $Expected) {
        throw "FAIL ${Label}: expected HTTP $Expected, received HTTP $($Response.Status)."
    }
    $script:Checks++
    Write-Host "PASS $Label"
    return $Response.Json
}

function Assert-Check {
    param([bool] $Condition, [string] $Label)
    if (-not $Condition) { throw "FAIL $Label" }
    $script:Checks++
    Write-Host "PASS $Label"
}

function Refresh-Csrf {
    param([hashtable] $Client)
    $response = Send-Api $Client 'GET' '/api/auth/csrf'
    if ($response.Status -ne 200 -or -not $response.Json.token) { throw 'CSRF bootstrap failed.' }
    $Client.Csrf = $response.Json.token
}

$anonymous = New-Client
$manager = New-Client
$customer = New-Client
Refresh-Csrf $anonymous
Refresh-Csrf $manager
Refresh-Csrf $customer

$null = Expect-Status (Send-Api $anonymous 'GET' '/api/appointments') 401 'Anonymous cannot list appointments'
$null = Expect-Status (Send-Api $anonymous 'POST' '/api/appointments' @{} -NoCsrf) 400 'Missing CSRF token is rejected'
$login = Expect-Status (Send-Api $manager 'POST' '/api/auth/login' @{ username = 'admin'; password = '123' }) 200 'Manager login'
Assert-Check ($login.role -eq 'Manager') 'Manager role is returned'
Refresh-Csrf $manager
$login = Expect-Status (Send-Api $customer 'POST' '/api/auth/login' @{ username = 'khach'; password = '123' }) 200 'Customer login'
Assert-Check ($login.role -eq 'Customer') 'Customer role is returned'
Refresh-Csrf $customer
$null = Expect-Status (Send-Api $customer 'GET' '/api/appointments') 403 'Customer cannot list manager appointments'
$null = Expect-Status (Send-Api $customer 'POST' '/api/services' @{ name = 'Forbidden'; price = 1000; description = ''; imageUrl = '' }) 403 'Customer cannot write services'

$catalog = Expect-Status (Send-Api $anonymous 'GET' '/api/services') 200 'Public services catalogue loads'
Assert-Check (@($catalog.services).Count -gt 0) 'Service seed data exists'
$tag = 'Smoke' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
$serviceData = @{
    name = $tag + '-Unused'; price = 123000; imageUrl = ''
    description = '<p onclick="alert(1)">Smoke <strong>safe</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>'
}
$unused = Expect-Status (Send-Api $manager 'POST' '/api/services' $serviceData) 201 'Create service'
Assert-Check ($unused.description -notmatch '<\s*(script|img)\b|\bonclick\s*=|\bonerror\s*=') 'Description removes executable tags and attributes'
Assert-Check ($unused.description -match '<strong>safe</strong>') 'Description retains supported formatting'
$null = Expect-Status (Send-Api $anonymous 'GET' ('/api/services/' + $unused.id)) 200 'Read service detail'
$serviceData.name = $tag + '-Edited'
$serviceData.price = 124000
$edited = Expect-Status (Send-Api $manager 'PUT' ('/api/services/' + $unused.id) $serviceData) 200 'Edit service'
Assert-Check ($edited.name -eq $serviceData.name -and $edited.price -eq 124000) 'Edited service values persist'
$badPrice = $serviceData.Clone()
$badPrice.name = $tag + '-BadPrice'
$badPrice.price = -1
$null = Expect-Status (Send-Api $manager 'POST' '/api/services' $badPrice) 400 'Negative service price is rejected'
$null = Expect-Status (Send-Api $manager 'DELETE' ('/api/services/' + $unused.id)) 200 'Delete unused service'
$null = Expect-Status (Send-Api $anonymous 'GET' ('/api/services/' + $unused.id)) 404 'Deleted service is unavailable'

$serviceData.name = $tag + '-Booked'
$serviceData.description = '<p>Smoke test service.</p>'
$bookedService = Expect-Status (Send-Api $manager 'POST' '/api/services' $serviceData) 201 'Create bookable service'
$tomorrow = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).AddDays(1).ToString('yyyy-MM-dd')
# Keep the script ASCII-compatible with Windows PowerShell 5.1 source decoding.
$carType = [string][char]0x00D4 + ' t' + [char]0x00F4
$booking = @{
    customerName = $tag + ' Customer'; phone = '0900000001'; vehicleType = $carType
    brand = 'Test'; licensePlate = 'TEST-001'; service = $bookedService.name
    date = $tomorrow; time = '10:00'; note = 'Synthetic smoke test only.'
}
$invalid = $booking.Clone()
$invalid.phone = 'invalid'
$null = Expect-Status (Send-Api $anonymous 'POST' '/api/appointments' $invalid) 400 'Invalid booking phone is rejected'

$null = Expect-Status (Send-Api $anonymous 'PUT' '/api/appointments/draft' $booking) 200 'Save booking draft in session'
$draft = Expect-Status (Send-Api $anonymous 'GET' '/api/appointments/draft') 200 'Read booking draft'
Assert-Check ($draft.draft.customerName -eq $booking.customerName) 'Draft values survive a separate request'
$otherDraft = Expect-Status (Send-Api $customer 'GET' '/api/appointments/draft') 200 'Read separate browser session draft'
Assert-Check ($null -eq $otherDraft.draft) 'Booking draft is isolated between sessions'
$null = Expect-Status (Send-Api $anonymous 'DELETE' '/api/appointments/draft') 204 'Clear booking draft'
$draft = Expect-Status (Send-Api $anonymous 'GET' '/api/appointments/draft') 200 'Read cleared draft'
Assert-Check ($null -eq $draft.draft) 'Cleared draft is empty'

$first = Expect-Status (Send-Api $anonymous 'POST' '/api/appointments' $booking) 201 'Create valid booking'
Assert-Check ($first.status -eq 'Pending' -and $first.reference.StartsWith('AF-')) 'New booking starts pending with a reference'
$lookupPath = '/api/repairs/lookup?reference=' + [Uri]::EscapeDataString($first.reference) + '&phone=0900000001'
$lookup = Expect-Status (Send-Api $anonymous 'GET' $lookupPath) 200 'Lookup with correct code and phone'
Assert-Check ($null -eq $lookup.phone -and $lookup.maskedPhone -eq '******0001') 'Public lookup masks the phone number'
$null = Expect-Status (Send-Api $anonymous 'GET' ($lookupPath -replace '0900000001$', '0900000002')) 404 'Lookup rejects incorrect phone'
$null = Expect-Status (Send-Api $manager 'GET' ('/api/appointments/' + $first.reference)) 200 'Manager can read booking detail'
$statusPath = '/api/appointments/' + $first.reference + '/status'
$null = Expect-Status (Send-Api $manager 'PUT' $statusPath @{ status = 'Completed'; processingNote = '' }) 409 'Status cannot skip directly to completed'
$null = Expect-Status (Send-Api $manager 'PUT' $statusPath @{ status = 'Confirmed'; processingNote = 'Smoke confirmed.' }) 200 'Confirm appointment'
$null = Expect-Status (Send-Api $manager 'PUT' $statusPath @{ status = 'InProgress'; processingNote = 'Smoke repairing.' }) 200 'Start repair'
$null = Expect-Status (Send-Api $anonymous 'POST' ('/api/appointments/' + $first.reference + '/cancel') @{ phone = '0900000001' }) 409 'Customer cannot cancel a repair already started'
$null = Expect-Status (Send-Api $manager 'PUT' $statusPath @{ status = 'Completed'; processingNote = 'Smoke completed.' }) 200 'Complete repair'
$null = Expect-Status (Send-Api $manager 'PUT' $statusPath @{ status = 'Pending'; processingNote = '' }) 409 'Completed appointment cannot reopen'
$lookup = Expect-Status (Send-Api $anonymous 'GET' $lookupPath) 200 'Lookup reflects completed repair'
Assert-Check ($lookup.status -eq 'Completed' -and $lookup.processingNote -eq 'Smoke completed.') 'Public progress includes the current processing note'

$booking.time = '10:30'
$second = Expect-Status (Send-Api $anonymous 'POST' '/api/appointments' $booking) 201 'Create second booking'
$null = Expect-Status (Send-Api $anonymous 'POST' ('/api/appointments/' + $second.reference + '/cancel') @{ phone = '0900000002' }) 404 'Cancellation rejects incorrect phone'
$cancelled = Expect-Status (Send-Api $anonymous 'POST' ('/api/appointments/' + $second.reference + '/cancel') @{ phone = '0900000001' }) 200 'Cancel pending appointment'
Assert-Check ($cancelled.status -eq 'Cancelled') 'Cancellation state is saved'
$null = Expect-Status (Send-Api $manager 'DELETE' ('/api/services/' + $bookedService.id)) 409 'Referenced service cannot be deleted'

$query = '/api/appointments?q=' + [Uri]::EscapeDataString($tag) + '&pageSize=1&page='
$page1 = Expect-Status (Send-Api $manager 'GET' ($query + '1')) 200 'Read first server-side page'
$page2 = Expect-Status (Send-Api $manager 'GET' ($query + '2')) 200 'Read second server-side page'
Assert-Check ($page1.total -eq 2 -and $page1.totalPages -eq 2 -and @($page1.appointments).Count -eq 1) 'Server returns the requested page size and total'
Assert-Check ($page1.appointments[0].reference -ne $page2.appointments[0].reference) 'Pagination returns distinct appointments'
$filtered = Expect-Status (Send-Api $manager 'GET' ('/api/appointments?q=' + [Uri]::EscapeDataString($tag) + '&status=Completed&date=' + $tomorrow)) 200 'Filter appointments by search, status and date'
Assert-Check ($filtered.total -eq 1 -and $filtered.appointments[0].reference -eq $first.reference) 'Combined server filters return the matching appointment'

# Simple inventory CRUD is independent of appointments and repair status.
$partData = @{ sku = $tag + '-A'; name = $tag + ' Part A'; unit = 'piece'; stock = 5; unitPrice = 25000 }
$null = Expect-Status (Send-Api $anonymous 'GET' '/api/inventory') 401 'Anonymous cannot read inventory'
$null = Expect-Status (Send-Api $anonymous 'POST' '/api/inventory' $partData) 401 'Anonymous cannot write inventory'
$null = Expect-Status (Send-Api $customer 'GET' '/api/inventory') 403 'Customer cannot read inventory'
$null = Expect-Status (Send-Api $customer 'POST' '/api/inventory' $partData) 403 'Customer cannot write inventory'
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $partData -NoCsrf) 400 'Inventory mutation requires CSRF'
$partA = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $partData) 201 'Create inventory part'
Assert-Check ($partA.sku -eq $partData.sku.ToUpperInvariant() -and $partA.stock -eq 5) 'Inventory values are saved and SKU normalized'
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $partData) 400 'Duplicate inventory SKU is rejected'
$invalidPart = $partData.Clone()
$invalidPart.sku = $tag + '-BAD'
$invalidPart.stock = -1
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $invalidPart) 400 'Negative stock is rejected'
$invalidPart.stock = 1.5
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $invalidPart) 400 'Fractional stock is rejected'
$invalidPart.stock = 1
$invalidPart.unitPrice = -1
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $invalidPart) 400 'Negative inventory price is rejected'
$invalidPart.unitPrice = 1.5
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $invalidPart) 400 'Fractional inventory price is rejected'
$invalidPart.unitPrice = 1
$invalidPart.sku = '   '
$null = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $invalidPart) 400 'Whitespace-only SKU is rejected'
$partData.stock = 8
$partData.unitPrice = 30000
$partA = Expect-Status (Send-Api $manager 'PUT' ('/api/inventory/' + $partA.id) $partData) 200 'Edit inventory part'
Assert-Check ($partA.stock -eq 8 -and $partA.unitPrice -eq 30000) 'Edited inventory values persist'
$partData.sku = $tag + '-B'
$partData.name = $tag + ' Part B'
$partB = Expect-Status (Send-Api $manager 'POST' '/api/inventory' $partData) 201 'Create second inventory part'
$inventoryQuery = '/api/inventory?q=' + [Uri]::EscapeDataString($tag) + '&pageSize=1&page='
$inventoryPage1 = Expect-Status (Send-Api $manager 'GET' ($inventoryQuery + '1')) 200 'Read first inventory search page'
$inventoryPage2 = Expect-Status (Send-Api $manager 'GET' ($inventoryQuery + '2')) 200 'Read second inventory search page'
Assert-Check ($inventoryPage1.total -eq 2 -and $inventoryPage1.totalPages -eq 2 -and @($inventoryPage1.items).Count -eq 1) 'Inventory search uses server-side pagination'
Assert-Check ($inventoryPage1.items[0].id -ne $inventoryPage2.items[0].id) 'Inventory pages contain distinct parts'
$null = Expect-Status (Send-Api $manager 'DELETE' ('/api/inventory/' + $partA.id)) 200 'Delete first test part'
$null = Expect-Status (Send-Api $manager 'DELETE' ('/api/inventory/' + $partB.id)) 200 'Delete second test part'
$inventoryAfterDelete = Expect-Status (Send-Api $manager 'GET' ($inventoryQuery + '1')) 200 'Search after deleting test parts'
Assert-Check ($inventoryAfterDelete.total -eq 0) 'Deleted inventory parts no longer appear'

# Revenue is a simple receipt ledger, one entry for each completed appointment.
$vietnamNow = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7))
$today = $vietnamNow.ToString('yyyy-MM-dd')
$yesterday = $vietnamNow.AddDays(-1).ToString('yyyy-MM-dd')
$receipt = @{ reference = $first.reference; amount = 500000; paidOn = $today; note = 'Synthetic smoke receipt.' }
$null = Expect-Status (Send-Api $anonymous 'GET' '/api/revenue') 401 'Anonymous cannot read revenue'
$null = Expect-Status (Send-Api $anonymous 'POST' '/api/revenue' $receipt) 401 'Anonymous cannot write revenue'
$null = Expect-Status (Send-Api $customer 'GET' '/api/revenue') 403 'Customer cannot read revenue'
$null = Expect-Status (Send-Api $customer 'POST' '/api/revenue' $receipt) 403 'Customer cannot write revenue'
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $receipt -NoCsrf) 400 'Revenue mutation requires CSRF'
$emptyRevenue = Expect-Status (Send-Api $manager 'GET' '/api/revenue') 200 'Read initial revenue ledger'
Assert-Check ($emptyRevenue.total -eq 0 -and $emptyRevenue.totalAmount -eq 0 -and $emptyRevenue.todayAmount -eq 0 -and $emptyRevenue.monthAmount -eq 0) 'Empty revenue ledger returns zero totals'
$eligible = Expect-Status (Send-Api $manager 'GET' '/api/revenue/eligible') 200 'Read completed appointments eligible for a receipt'
Assert-Check (@($eligible.appointments | Where-Object { $_.reference -eq $first.reference }).Count -eq 1) 'Completed appointment is initially eligible'
$invalidReceipt = $receipt.Clone()
$invalidReceipt.paidOn = $vietnamNow.AddDays(1).ToString('yyyy-MM-dd')
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $invalidReceipt) 400 'Future receipt date is rejected'
$invalidReceipt.paidOn = $today
$invalidReceipt.amount = 0
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $invalidReceipt) 400 'Zero receipt amount is rejected'
$invalidReceipt.amount = 1.5
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $invalidReceipt) 400 'Fractional receipt amount is rejected'
$invalidReceipt.amount = 500000
$invalidReceipt.reference = 'AF-NOT-FOUND'
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $invalidReceipt) 404 'Receipt rejects an unknown appointment'
$invalidReceipt.reference = $second.reference
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $invalidReceipt) 409 'Receipt rejects a cancelled appointment'
$savedReceipt = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $receipt) 201 'Record receipt for completed appointment'
Assert-Check ($savedReceipt.reference -eq $first.reference -and $savedReceipt.amount -eq 500000) 'Receipt records the amount against its appointment'
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $receipt) 409 'Duplicate receipt is rejected'
$eligible = Expect-Status (Send-Api $manager 'GET' '/api/revenue/eligible') 200 'Refresh receipt eligibility'
Assert-Check (@($eligible.appointments | Where-Object { $_.reference -eq $first.reference }).Count -eq 0) 'Recorded appointment is excluded from receipt eligibility'
$receipt.amount = 700000
$receipt.note = 'Corrected synthetic amount.'
$savedReceipt = Expect-Status (Send-Api $manager 'PUT' ('/api/revenue/' + $first.reference) $receipt) 200 'Correct recorded receipt amount'
Assert-Check ($savedReceipt.amount -eq 700000) 'Receipt correction saves the new amount'
$todayRevenue = Expect-Status (Send-Api $manager 'GET' ('/api/revenue?from=' + $today + '&to=' + $today)) 200 'Filter revenue to today'
Assert-Check ($todayRevenue.total -eq 1 -and $todayRevenue.totalAmount -eq 700000 -and $todayRevenue.todayAmount -eq 700000) 'Receipt correction updates totals without creating another row'
$null = Expect-Status (Send-Api $manager 'GET' '/api/revenue?from=invalid') 400 'Invalid revenue date filter is rejected'
$null = Expect-Status (Send-Api $manager 'GET' ('/api/revenue?from=' + $tomorrow + '&to=' + $today)) 400 'Reversed revenue date range is rejected'

$booking.time = '11:00'
$third = Expect-Status (Send-Api $anonymous 'POST' '/api/appointments' $booking) 201 'Create third synthetic booking for revenue pagination'
$thirdStatusPath = '/api/appointments/' + $third.reference + '/status'
$null = Expect-Status (Send-Api $manager 'PUT' $thirdStatusPath @{ status = 'Confirmed'; processingNote = '' }) 200 'Confirm third appointment'
$null = Expect-Status (Send-Api $manager 'PUT' $thirdStatusPath @{ status = 'InProgress'; processingNote = '' }) 200 'Start third repair'
$null = Expect-Status (Send-Api $manager 'PUT' $thirdStatusPath @{ status = 'Completed'; processingNote = '' }) 200 'Complete third repair'
$yesterdayReceipt = @{ reference = $third.reference; amount = 200000; paidOn = $yesterday; note = 'Synthetic prior-day receipt.' }
$null = Expect-Status (Send-Api $manager 'POST' '/api/revenue' $yesterdayReceipt) 201 'Record prior-day receipt'
$revenueQuery = '/api/revenue?from=' + $yesterday + '&to=' + $today + '&pageSize=1&page='
$revenuePage1 = Expect-Status (Send-Api $manager 'GET' ($revenueQuery + '1')) 200 'Read first revenue page'
$revenuePage2 = Expect-Status (Send-Api $manager 'GET' ($revenueQuery + '2')) 200 'Read second revenue page'
Assert-Check ($revenuePage1.total -eq 2 -and $revenuePage1.totalPages -eq 2 -and @($revenuePage1.entries).Count -eq 1) 'Revenue pagination returns the requested size and total'
Assert-Check ($revenuePage1.entries[0].reference -ne $revenuePage2.entries[0].reference) 'Revenue pages contain distinct receipts'
Assert-Check ($revenuePage1.totalAmount -eq 900000 -and $revenuePage1.todayAmount -eq 700000) 'Revenue total spans the filter while today total stays independent'
$expectedMonthAmount = if ($vietnamNow.Day -eq 1) { 700000 } else { 900000 }
Assert-Check ($revenuePage1.monthAmount -eq $expectedMonthAmount) 'Month revenue handles the first day of a month correctly'
$onlyYesterday = Expect-Status (Send-Api $manager 'GET' ('/api/revenue?from=' + $yesterday + '&to=' + $yesterday)) 200 'Filter revenue to yesterday only'
Assert-Check ($onlyYesterday.totalAmount -eq 200000 -and $onlyYesterday.todayAmount -eq 700000 -and $onlyYesterday.monthAmount -eq $expectedMonthAmount) 'Dashboard day and month totals are independent of report filters'
$lookupAfterRevenue = Expect-Status (Send-Api $anonymous 'GET' $lookupPath) 200 'Public progress still loads after a receipt is recorded'
Assert-Check ($null -eq $lookupAfterRevenue.PSObject.Properties['amount'] -and $null -eq $lookupAfterRevenue.PSObject.Properties['revenue']) 'Public lookup does not expose receipt amounts'

$null = Expect-Status (Send-Api $customer 'POST' '/api/auth/logout') 200 'Customer logout'
$null = Expect-Status (Send-Api $customer 'GET' '/api/appointments') 401 'Logout clears authenticated access'
Write-Host ("All {0} smoke checks passed." -f $script:Checks)
