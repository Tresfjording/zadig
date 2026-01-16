$response = Invoke-WebRequest -Uri 'https://www.hvakosterstrommen.no/api/v1/prices/2026/01-16_NO1.json' -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
Write-Host "First few entries from NO1:"
Write-Host ($data | ConvertTo-Json -Depth 2 | Select-Object -First 10)
Write-Host "Available keys:"
$data | Get-Member -MemberType NoteProperty | Select-Object -First 5
