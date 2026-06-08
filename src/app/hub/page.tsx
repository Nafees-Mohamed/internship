import { Suspense } from "react";
import QuestionsList from "../questions-list";
import { getQuestionsPage } from "@/lib/questions";

// Render on every request so new questions and votes show up immediately.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function HubPage() {
  const { questions, hasMore } = await getQuestionsPage(0, PAGE_SIZE);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-7 flex items-center justify-between">
        <div>
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Live Arena
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Interactive Hub</h1>
          <p className="mt-1.5 text-sm text-muted">
            Ask questions, answer live polls, and rise on the leaderboard!
          </p>
        </div>
      </header>
      <Suspense fallback={<div className="text-center py-10 text-sm text-muted">Loading live dashboard...</div>}>
        <QuestionsList initialQuestions={questions} initialHasMore={hasMore} />
      </Suspense>
    </main>
  );
}
