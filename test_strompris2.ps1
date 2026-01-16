try {
  $response = Invoke-WebRequest -Uri 'https://strompris.no/api/price/2026/01/16/SE3' -UseBasicParsing -MaximumRedirection 5
  $data = $response.Content | ConvertFrom-Json
  Write-Host "Stockholm SE3 data:"
  Write-Host ($data | ConvertTo-Json -Depth 2)
} catch {
  Write-Host "Error: $_"
}

Write-Host ""
Write-Host "Trying with www prefix:"
try {
  $response = Invoke-WebRequest -Uri 'https://www.strompris.no/api/price/2026/01/16/SE3' -UseBasicParsing -MaximumRedirection 5
  $data = $response.Content | ConvertFrom-Json
  Write-Host "Stockholm SE3 data (www):"
  Write-Host ($data | ConvertTo-Json -Depth 2 | Select-Object -First 300)
} catch {
  Write-Host "Error: $_"
}
