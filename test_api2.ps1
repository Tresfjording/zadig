[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Prøv ENTSOE eller andre kilder
Write-Host "Tester Nordpool/Elspotpriser:"
try {
  $url = "https://www.nordpoolgroup.com/en/Market-data1/Power-system-data/"
  $response = Invoke-WebRequest -Uri $url -ErrorAction Stop -UseBasicParsing
  Write-Host "Nordpool: OK"
} catch {
  Write-Host "Nordpool: FAILED"
}

Write-Host ""
Write-Host "Tester strompris.se (Sverige):"
try {
  $url = "https://www.strompris.se/"
  $response = Invoke-WebRequest -Uri $url -ErrorAction Stop -UseBasicParsing
  Write-Host "strompris.se: OK"
} catch {
  Write-Host "strompris.se: FAILED"
}

Write-Host ""
Write-Host "Tester Energinet (Danmark):"
try {
  $url = "https://www.energinet.dk/en/"
  $response = Invoke-WebRequest -Uri $url -ErrorAction Stop -UseBasicParsing
  Write-Host "Energinet: OK"
} catch {
  Write-Host "Energinet: FAILED"
}
