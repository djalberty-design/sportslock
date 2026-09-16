$content = Get-Content src/components/app/board-page.tsx -Raw
$newGameCard = Get-Content scratch/newCard.txt -Raw
$content = $content -replace '(?s)function GameCard\(\{.*?\} \)\{.*?<\/Link>`n    \);`n  \}', $newGameCard
Set-Content src/components/app/board-page.tsx $content
