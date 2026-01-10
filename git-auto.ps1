# git-auto.ps1
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$branch = git rev-parse --abbrev-ref HEAD

git add .

git commit -m "Auto-commit $timestamp"

if ($LASTEXITCODE -eq 0) {
    git push origin $branch
    Write-Host "✅ Commit pushed to '$branch' at $timestamp"
} else {
    Write-Host "⚠️ No changes to commit or commit failed."
}