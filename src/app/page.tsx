import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-warm/60 px-6 py-4 sm:px-12 flex items-center justify-between bg-surface/30 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg shadow-sm">
            S
          </span>
          <span className="font-bold tracking-tight text-lg">Slido Arena</span>
        </div>
        <Link 
          href="/hub" 
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-strong shadow-sm hover:shadow-md"
        >
          Enter Hub
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center space-y-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1 text-xs font-semibold text-brand">
            Interactive Event Engagement
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Engage Your Audience with <br />
            <span className="text-brand">Real-Time Q&A & Polling</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted leading-relaxed">
            Elevate participation in meetings, classes, or presentations. 
            Allow participants to submit questions, vote on multiple-choice games, earn points, and climb the live leaderboard.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/hub"
            className="w-full sm:w-auto rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-strong shadow-md hover:shadow-lg text-center"
          >
            Get Started Free
          </Link>
          <Link
            href="/hub?tab=polls"
            className="w-full sm:w-auto rounded-xl border border-warm bg-surface px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-brand-soft hover:text-brand hover:border-brand/30 text-center"
          >
            Try Live Polling
          </Link>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {/* Card 1: Live Q&A */}
          <div className="rounded-2xl border border-warm/60 bg-surface p-6 text-left shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center text-brand text-lg">
                💬
              </div>
              <h3 className="text-lg font-bold text-foreground">Live Q&A</h3>
              <p className="text-sm text-muted leading-relaxed">
                Empower your audience to ask questions without hesitation. Crowd-source popular questions via live upvotes.
              </p>
            </div>
            <Link
              href="/hub?tab=qa"
              className="mt-6 inline-flex items-center text-sm font-bold text-brand hover:underline"
            >
              Open Q&A &rarr;
            </Link>
          </div>

          {/* Card 2: Interactive Polls */}
          <div className="rounded-2xl border border-warm/60 bg-surface p-6 text-left shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center text-brand text-lg">
                🗳️
              </div>
              <h3 className="text-lg font-bold text-foreground">Interactive Polls</h3>
              <p className="text-sm text-muted leading-relaxed">
                Publish multiple-choice questions instantly. Track live audience breakdown percentages and correct answers.
              </p>
            </div>
            <Link
              href="/hub?tab=polls"
              className="mt-6 inline-flex items-center text-sm font-bold text-brand hover:underline"
            >
              Open Polls &rarr;
            </Link>
          </div>

          {/* Card 3: Live Leaderboard */}
          <div className="rounded-2xl border border-warm/60 bg-surface p-6 text-left shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center text-brand text-lg">
                👑
              </div>
              <h3 className="text-lg font-bold text-foreground">Live Leaderboard</h3>
              <p className="text-sm text-muted leading-relaxed">
                Gamify your session by awarding 10 points for correct poll responses. Display real-time rankings of participants.
              </p>
            </div>
            <Link
              href="/hub?tab=leaderboard"
              className="mt-6 inline-flex items-center text-sm font-bold text-brand hover:underline"
            >
              Open Leaderboard &rarr;
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-warm/60 py-6 text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} Slido Arena. Created for PDC Summer Internship.
      </footer>
    </div>
  );
}