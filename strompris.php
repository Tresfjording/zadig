<?php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Dummydata – bytt ut med ekte logikk senere
echo json_encode(["pris" => "0.52", "feil" => false]);


//header("Access-Control-Allow-Origin: *");
//header("Content-Type: application/json");

// Hent HTML fra nettsiden
//$html = @file_get_contents("https://www.strompriser.no/molde");

if (!$html) {
    echo json_encode(["pris" => null, "feil" => "Klarte ikke hente HTML"]);
    exit;
}

// Fjern linjeskift og ekstra mellomrom
$html = preg_replace('/\s+/', ' ', $html);

// Dump HTML til testformål (midlertidig)
// file_put_contents("dump.html", $html);

// Prøv flere mønstre
$patterns = [
    '/Strømpris nå er\s*([0-9]+(?:[.,][0-9]+)?)\s*kr\s*\/\s*kWh/i',
    '/Strømpris nå.*?([0-9]+(?:[.,][0-9]+)?)\s*kr/i',
    '/([0-9]+(?:[.,][0-9]+)?)\s*kr\s*\/\s*kWh/i'
];

$pris = null;
foreach ($patterns as $pattern) {
    if (preg_match($pattern, $html, $match)) {
        $pris = str_replace(",", ".", $match[1]);
        break;
    }
}

if ($pris) {
    echo json_encode(["pris" => $pris]);
} else {
    echo json_encode(["pris" => null, "feil" => "Ingen mønstre traff"]);
}
?>