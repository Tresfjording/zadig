[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$zones = @('SE1', 'SE2', 'SE3', 'SE4', 'DK1', 'DK2')
foreach ($zone in $zones) {
  try {
    $url = "https://www.hvakosterstrommen.no/api/v1/prices/2026/01-16_$zone.json"
    $response = Invoke-WebRequest -Uri $url -ErrorAction Stop -TimeoutSec 5 -UseBasicParsing
    Write-Host "$zone : OK"
  } catch {
    Write-Host "$zone : FAILED - $($_.Exception.Message)"
  }
}
