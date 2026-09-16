$content = Get-Content src/components/app/board-page.tsx -Raw
$oldStr = '<p className="mt-3 text-xs font-medium text-gold">Bet this one game →</p>'
$newStr = '<div className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-gold/10 px-3 text-sm font-medium text-gold ring-1 ring-inset ring-gold/20 hover:bg-gold/20">⚡ Fast Log Ticket</div>'
$content = $content.Replace($oldStr, $newStr)
Set-Content src/components/app/board-page.tsx $content

$content2 = Get-Content src/components/app/pick-card.tsx -Raw
$oldStr2 = '<p className="mt-3 text-xs font-medium text-gold">Full breakdown →</p>'
$content2 = $content2.Replace($oldStr2, $newStr)
Set-Content src/components/app/pick-card.tsx $content2
