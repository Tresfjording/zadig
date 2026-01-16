$response = Invoke-WebRequest -Uri 'https://strompris.no/api/price/2026/01/16/SE3' -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
Write-Host "Stockholm SE3 data:"
Write-Host ($data | ConvertTo-Json -Depth 2)
Write-Host ""

$response2 = Invoke-WebRequest -Uri 'https://strompris.no/api/price/2026/01/16/DK1' -UseBasicParsing  
$data2 = $response2.Content | ConvertFrom-Json
Write-Host "København DK1 data:"
Write-Host ($data2 | ConvertTo-Json -Depth 2)
