# git-auto.ps1
# git-auto-tag.ps1
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$branch = git rev-parse --abbrev-ref HEAD
$tag = "auto-$timestamp"

git add .

git commit -m "Auto-commit $timestamp"

if ($LASTEXITCODE -eq 0) {
    git tag $tag
    git push origin $branch
    git push origin $tag
    Write-Host "✅ Commit and tag '$tag' pushed to '$branch'"
} else {
    Write-Host "⚠️ No changes to commit or commit failed. Tag not created."
}