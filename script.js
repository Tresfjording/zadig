// Liste over JSON-filer som skal søkes i
const files = ["fact.json", "djt.json"];

// Fyll dropdown-menyen med filene
const fileSelect = document.getElementById("fileSelect");
const allOption = document.createElement("option");
allOption.value = "all";
allOption.textContent = "Alle filer";
fileSelect.appendChild(allOption);

files.forEach(file => {
  const opt = document.createElement("option");
  opt.value = file;
  opt.textContent = file;
  fileSelect.appendChild(opt);
});

// Legg til event listener på søkeknappen
document.getElementById("searchBtn").addEventListener("click", async () => {
  const query = document.getElementById("searchBox").value.toLowerCase();
  const selectedFile = fileSelect.value;
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "";

  if (!query) {
    resultsContainer.innerHTML = "<p>Vennligst skriv inn et søkeord.</p>";
    return;
  }

  const searchFiles = selectedFile === "all" ? files : [selectedFile];

  for (const file of searchFiles) {
    try {
      const response = await fetch(file);
      const data = await response.json();

      // Sjekk at data er en array
      const arr = Array.isArray(data) ? data : [];

      const matches = arr.filter(item => item.toLowerCase().includes(query));

      if (matches.length > 0) {
        const fileSection = document.createElement("div");
        fileSection.classList.add("file-results");
        fileSection.innerHTML = `<h2>Resultater fra ${file}:</h2>`;
        matches.forEach(match => {
          const p = document.createElement("p");
          p.textContent = match;
          fileSection.appendChild(p);
        });
        resultsContainer.appendChild(fileSection);
      }
    } catch (err) {
      console.error("Feil ved lasting av", file, err);
    }
  }

  if (!resultsContainer.innerHTML) {
    resultsContainer.innerHTML = "<p>Ingen treff funnet.</p>";
  }
});
