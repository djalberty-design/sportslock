$content = Get-Content src/components/app/board-page.tsx -Raw
$content = $content -replace '(?s)Fast Log Ticket</div>.*?function GameGrid', "Fast Log Ticket</div>`n      </Link>`n    </article>`n  );`n}`n`nfunction GameGrid"
Set-Content src/components/app/board-page.tsx $content
