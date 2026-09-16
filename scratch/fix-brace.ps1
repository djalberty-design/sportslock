$content = Get-Content src/components/app/board-page.tsx -Raw
$content = $content -replace '(?s)Fast Log Ticket</div>.*?</Link>.*?</article>.*?  \);.*?  \}', "Fast Log Ticket</div>`n      </Link>`n    </article>`n  );`n}"
Set-Content src/components/app/board-page.tsx $content
