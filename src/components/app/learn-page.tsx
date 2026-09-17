import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LESSONS, RESEARCH_METHOD, isLastLesson, nextLearnIndex, prevLearnIndex } from "@/lib/learn/lessons";
import { useDeskStore } from "@/lib/desk-store";

export function LearnPage() {
  const learnIndex = useDeskStore((s) => s.learnIndex);
  const setLearnIndex = useDeskStore((s) => s.setLearnIndex);
  const lesson = LESSONS[learnIndex] ?? LESSONS[0];
  const last = isLastLesson(learnIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setLearnIndex(nextLearnIndex(learnIndex));
      if (e.key === "ArrowLeft") setLearnIndex(prevLearnIndex(learnIndex));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learnIndex, setLearnIndex]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-emerald-500">{LESSONS.length} short lessons · then the full method</p>
      <h1 className="font-display mt-2 text-3xl text-ink">Learn the words in order.</h1>
      <p className="mt-3 text-ink/80">
        You already know sports. These pages only translate the betting words so AI Picks makes sense.
      </p>

      <article className="paper-card mt-6 p-6 md:p-8">
        <p className="stamp text-emerald-500">{lesson.kicker}</p>
        <h2 className="font-display mt-3 text-2xl text-ink">{lesson.title}</h2>
        <div className="mt-5 space-y-3 text-base text-ink/90">
          {lesson.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <aside className="mt-6 rounded-md bg-wash p-4">
          <p className="stamp text-emerald-500">{lesson.term.word}</p>
          <p className="mt-2 text-sm">{lesson.term.meaning}</p>
          <p className="mt-1 text-sm text-muted">{lesson.term.why}</p>
        </aside>
        {lesson.tryThis ? (
          <a
            href={lesson.tryThis.to}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
          >
            {lesson.tryThis.label}
          </a>
        ) : null}
      </article>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setLearnIndex(prevLearnIndex(learnIndex))}
          disabled={learnIndex === 0}
        >
          <ChevronLeft className="size-4" />
          {learnIndex === 0 ? "Where" : LESSONS[learnIndex - 1]?.term.word}
        </Button>
        <Button
          onClick={() => setLearnIndex(nextLearnIndex(learnIndex))}
          disabled={last}
        >
          {last ? "Done" : LESSONS[learnIndex + 1]?.term.word}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <ol className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Progress">
        {LESSONS.map((l, i) => (
          <li key={l.id}>
            <button
              type="button"
              aria-label={l.title}
              aria-current={i === learnIndex ? "step" : undefined}
              onClick={() => setLearnIndex(i)}
              className={`size-2.5 rounded-full ${i === learnIndex ? "bg-emerald-500" : i < learnIndex ? "bg-ink" : "bg-line"}`}
            />
          </li>
        ))}
      </ol>

      <section className="paper-card mt-10 p-6 md:p-8">
        <p className="stamp text-emerald-500">Always visible</p>
        <h2 className="font-display mt-2 text-2xl text-ink">How we compile the numbers</h2>
        <p className="mt-3 text-sm text-ink/80">
          This is the cross-check behind every win chance on AI Picks, Games, and Parlay. Read it once. It does not change unless the board does.
        </p>
        <ol className="mt-5 space-y-4">
          {RESEARCH_METHOD.map((block, i) => (
            <li key={block.title}>
              <p className="font-medium text-emerald-500">
                {String(i + 1).padStart(2, "0")} · {block.title.replace(/^\d+\.\s/, "")}
              </p>
              <p className="mt-1 text-sm text-ink/90">{block.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-muted">
          Research, not a promise. Delayed public odds. Confirm every live number at Hard Rock Bet. 21+ · 1-800-GAMBLER.
        </p>
      </section>
    </div>
  );
}
