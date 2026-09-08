"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getVoterId } from "@/lib/voter";

type Question = {
  id: string;
  body: string;
  author: string | null;
  votes: number;
};

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

type ChallengeRecord = {
  pollId: string;
  question: string;
  optionSelectedId: string | null;
  optionSelectedText: string | null;
  correctOptionText: string;
  isCorrect: boolean;
  pointsEarned: number;
};

const TIMER_PER_QUESTION = 10; // 10 seconds per question

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"top" | "newest">("top");

  // Tabs state
  const [tab, setTab] = useState<"qa" | "polls" | "leaderboard" | "challenge">("qa");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (
      tabParam &&
      (tabParam === "qa" ||
        tabParam === "polls" ||
        tabParam === "leaderboard" ||
        tabParam === "challenge")
    ) {
      setTab(tabParam);
    }
  }, [tabParam]);

  // Toast notification system
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Hydration & Voter profile state
  const [hydrated, setHydrated] = useState(false);
  const [voterId, setVoterId] = useState("");
  const [username, setUsername] = useState("Anonymous Voter");
  const [points, setPoints] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Polls state
  const [polls, setPolls] = useState<any[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);

  // Create Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", "", ""]);
  const [correctOptionIdx, setCorrectOptionIdx] = useState(0);
  const [creatingPoll, setCreatingPoll] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // AI & Live Auto-refresh state
  const [improving, setImproving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ⚡ Rapid-Fire Challenge state
  const [challengeState, setChallengeState] = useState<"idle" | "running" | "finished">("idle");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_PER_QUESTION);
  const [challengeAnswers, setChallengeAnswers] = useState<ChallengeRecord[]>([]);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [explanations, setExplanations] = useState<
    Record<string, { loading: boolean; text?: string; error?: string }>
  >({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setHydrated(true);
    setVoterId(getVoterId());
  }, []);

  // Fetch profile on hydration
  const fetchProfile = useCallback(async () => {
    const id = getVoterId();
    if (!id) return;
    try {
      const res = await fetch(`/api/voters?voterId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setUsername(data.username || "Anonymous Voter");
        setPoints(data.points ?? 0);
        setNameInput(data.username || "Anonymous Voter");
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      fetchProfile();
    }
  }, [hydrated, fetchProfile]);

  // Save username
  async function saveUsername() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      addToast("Username cannot be empty", "error");
      return;
    }
    const currentId = getVoterId();
    try {
      const res = await fetch("/api/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: currentId, username: trimmed }),
      });
      if (res.ok) {
        setUsername(trimmed);
        setEditingName(false);
        addToast("Display name updated successfully!", "success");
        if (tab === "leaderboard") {
          fetchLeaderboard();
        }
      } else {
        const err = await res.json();
        addToast(err.error || "Failed to save username", "error");
      }
    } catch (err) {
      console.error("Failed to save username", err);
      addToast("Network error while saving name", "error");
    }
  }

  // Polls fetch
  const fetchPolls = useCallback(async () => {
    setLoadingPolls(true);
    const id = getVoterId();
    try {
      const res = await fetch(`/api/polls?voterId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch (err) {
      console.error("Failed to fetch polls", err);
    } finally {
      setLoadingPolls(false);
    }
  }, []);

  // Leaderboard fetch
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Tab change handler
  useEffect(() => {
    if (!hydrated) return;
    if (tab === "polls" || tab === "challenge") {
      fetchPolls();
    } else if (tab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [tab, hydrated, fetchPolls, fetchLeaderboard]);

  // Live Auto-Refresh Interval (6s)
  useEffect(() => {
    if (!autoRefresh || !hydrated) return;
    const interval = setInterval(() => {
      if (tab === "polls") fetchPolls();
      if (tab === "leaderboard") fetchLeaderboard();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, hydrated, tab, fetchPolls, fetchLeaderboard]);

  // Q&A search query handler
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const url = query
          ? `/api/questions?q=${encodeURIComponent(query)}`
          : `/api/questions`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
          setHasMore(data.hasMore ?? false);
        }
      } catch (err) {
        console.error("Error searching questions:", err);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  // ⚡ Rapid-Fire Challenge Start
  const startChallenge = () => {
    if (polls.length === 0) {
      addToast("No quiz questions available right now", "error");
      return;
    }
    setChallengeState("running");
    setChallengeIndex(0);
    setTimeLeft(TIMER_PER_QUESTION);
    setChallengeAnswers([]);
    setSelectedOptId(null);
    setIsTransitioning(false);
    setExplanations({});
  };

  // ⚡ Rapid-Fire Answer Selection with Instant Visual Feedback
  const handleSelectOption = useCallback(
    async (optId: string | null) => {
      if (isTransitioning) return; // Prevent double-clicks during transition

      setIsTransitioning(true);
      setSelectedOptId(optId);

      const currentPoll = polls[challengeIndex];
      if (!currentPoll) {
        setIsTransitioning(false);
        return;
      }

      const selectedOpt = currentPoll.options?.find((o: any) => o.id === optId);
      let isCorrect = false;
      let pointsEarned = 0;
      let correctText = currentPoll.options?.find((o: any) => o.is_correct)?.text || "";

      if (optId) {
        try {
          const res = await fetch(`/api/polls/${currentPoll.id}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ optionId: optId, voterId: getVoterId() }),
          });
          if (res.ok) {
            const data = await res.json();
            isCorrect = !!data.isCorrect;
            pointsEarned = data.pointsAwarded || (isCorrect ? 10 : 0);
            if (data.correctOptionText) {
              correctText = data.correctOptionText;
            }
          }
        } catch (e) {
          console.error("Error recording vote in challenge:", e);
        }
      }

      if (!correctText) {
        correctText = currentPoll.options?.[0]?.text || "N/A";
      }

      const record: ChallengeRecord = {
        pollId: currentPoll.id,
        question: currentPoll.question,
        optionSelectedId: optId,
        optionSelectedText: selectedOpt ? selectedOpt.text : null,
        correctOptionText: correctText,
        isCorrect,
        pointsEarned,
      };

      setChallengeAnswers((prev) => [...prev, record]);

      // Smooth 500ms feedback pause before advancing question
      setTimeout(() => {
        if (challengeIndex + 1 < polls.length) {
          setChallengeIndex((prev) => prev + 1);
          setTimeLeft(TIMER_PER_QUESTION);
          setSelectedOptId(null);
          setIsTransitioning(false);
        } else {
          setChallengeState("finished");
          setIsTransitioning(false);
          fetchProfile();
        }
      }, 500);
    },
    [polls, challengeIndex, isTransitioning, fetchProfile]
  );

  // Timer interval effect during challenge
  useEffect(() => {
    if (challengeState !== "running" || isTransitioning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          handleSelectOption(null); // Time expired auto-advance
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [challengeState, challengeIndex, isTransitioning, handleSelectOption]);

  // Explain My Answer AI function
  const fetchExplanation = async (record: ChallengeRecord) => {
    const key = record.pollId;
    setExplanations((prev) => ({
      ...prev,
      [key]: { loading: true },
    }));

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: record.question,
          userChoice: record.optionSelectedText || "",
          correctChoice: record.correctOptionText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExplanations((prev) => ({
          ...prev,
          [key]: { loading: false, text: data.explanation },
        }));
      } else {
        const data = await res.json();
        setExplanations((prev) => ({
          ...prev,
          [key]: { loading: false, error: data.error || "Could not generate explanation" },
        }));
      }
    } catch (err) {
      setExplanations((prev) => ({
        ...prev,
        [key]: { loading: false, error: "Network error fetching AI explanation" },
      }));
    }
  };

  // Q&A Submit Question
  async function submit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      addToast("Please enter a question draft first", "info");
      return;
    }

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed, author: username }),
      });

      if (!res.ok) {
        const errData = await res.json();
        addToast(errData.error || "Failed to post question", "error");
        return;
      }

      const created = await res.json();
      setQuestions((qs) => [{ ...created, votes: 0 }, ...qs]);
      setDraft("");
      addToast("Question submitted successfully!", "success");
    } catch (err) {
      console.error("Failed to submit question", err);
      addToast("Network error while submitting question", "error");
    }
  }

  // Q&A Upvote Question
  async function upvote(id: string) {
    const currentId = getVoterId();
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, votes: q.votes + 1 } : q))
    );

    try {
      const res = await fetch(`/api/questions/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: currentId }),
      });

      if (!res.ok) {
        setQuestions((qs) =>
          qs.map((q) => (q.id === id ? { ...q, votes: Math.max(0, q.votes - 1) } : q))
        );

        if (res.status === 409) {
          addToast("You have already upvoted this question!", "info");
        } else {
          const errData = await res.json();
          addToast(errData.error || "Failed to record upvote", "error");
        }
      } else {
        addToast("Upvoted!", "success");
      }
    } catch (err) {
      console.error("Upvote failed", err);
      setQuestions((qs) =>
        qs.map((q) => (q.id === id ? { ...q, votes: Math.max(0, q.votes - 1) } : q))
      );
      addToast("Network error while upvoting", "error");
    }
  }

  // Load more questions
  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions?offset=${questions.length}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions((qs) => [...qs, ...(data.questions || [])]);
        setHasMore(data.hasMore ?? false);
      }
    } catch (err) {
      console.error("Failed to load more questions", err);
    } finally {
      setLoading(false);
    }
  }

  // AI draft improvement
  async function improveDraft() {
    const trimmed = draft.trim();
    if (!trimmed) {
      addToast("Type a draft question to improve", "info");
      return;
    }
    setImproving(true);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setDraft(data.text);
          addToast("Draft improved with AI!", "success");
        }
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to improve draft", "error");
      }
    } catch (err) {
      console.error("Failed to improve draft", err);
      addToast("AI service unavailable", "error");
    } finally {
      setImproving(false);
    }
  }

  // Poll Voting
  async function submitVote(pollId: string, optionId: string) {
    const currentId = getVoterId();
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, voterId: currentId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.isCorrect) {
          addToast("🎉 Correct! You earned 10 points!", "success");
        } else {
          addToast("Incorrect choice. Better luck next time!", "info");
        }
        fetchPolls();
        fetchProfile();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to vote", "error");
      }
    } catch (err) {
      console.error("Failed to submit vote", err);
      addToast("Network error while voting", "error");
    }
  }

  // Poll Creation
  async function createPoll() {
    if (!pollQuestion.trim()) {
      addToast("Please enter a poll question", "error");
      return;
    }
    const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      addToast("Please provide at least 2 option choices", "error");
      return;
    }

    setCreatingPoll(true);
    try {
      const optionsPayload = filledOptions.map((text, idx) => ({
        text,
        is_correct: idx === correctOptionIdx,
      }));

      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pollQuestion.trim(), options: optionsPayload }),
      });

      if (res.ok) {
        setPollQuestion("");
        setPollOptions(["", "", ""]);
        setCorrectOptionIdx(0);
        addToast("Live poll published successfully!", "success");
        fetchPolls();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to create poll", "error");
      }
    } catch (err) {
      console.error("Failed to create poll", err);
      addToast("Network error while creating poll", "error");
    } finally {
      setCreatingPoll(false);
    }
  }

  // Sorted questions list
  const sortedQuestions = [...questions].sort((a, b) => {
    if (sortBy === "top") return b.votes - a.votes;
    return 0;
  });

  const totalPointsEarnedInChallenge = challengeAnswers.reduce(
    (sum, a) => sum + a.pointsEarned,
    0
  );
  const correctCount = challengeAnswers.filter((a) => a.isCorrect).length;

  return (
    <div className="space-y-6 relative">
      {/* Toast Floating Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all transform translate-y-0 flex items-center justify-between border ${
              toast.type === "success"
                ? "bg-emerald-900/90 text-emerald-100 border-emerald-700/50 backdrop-blur-md"
                : toast.type === "error"
                ? "bg-rose-900/90 text-rose-100 border-rose-700/50 backdrop-blur-md"
                : "bg-stone-900/90 text-stone-100 border-stone-700/50 backdrop-blur-md"
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="ml-3 opacity-60 hover:opacity-100 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Voter Profile Banner */}
      {hydrated && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                  className="rounded-lg border bg-background px-3 py-1 text-sm outline-none focus:border-brand"
                  maxLength={25}
                  placeholder="Enter your name..."
                />
                <button
                  onClick={saveUsername}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-strong transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameInput(username);
                  }}
                  className="rounded-lg border px-3 py-1 text-xs text-muted hover:bg-brand-soft transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{username}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-muted hover:text-brand transition-colors underline underline-offset-2"
                >
                  Edit Name
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-surface border-warm text-muted hover:text-foreground"
              }`}
              title="Toggle automatic updates every 6 seconds"
            >
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-stone-300"}`} />
              {autoRefresh ? "Live Auto-sync ON" : "Auto-sync OFF"}
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span>🏆 Score: {points} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-warm overflow-x-auto scrollbar-none">
        <button
          onClick={() => setTab("qa")}
          className={`flex-1 min-w-[90px] pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
            tab === "qa"
              ? "border-brand text-brand shadow-sm"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          💬 Q&A
        </button>
        <button
          onClick={() => setTab("polls")}
          className={`flex-1 min-w-[90px] pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
            tab === "polls"
              ? "border-brand text-brand shadow-sm"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          🗳️ Polls
        </button>
        <button
          onClick={() => setTab("challenge")}
          className={`flex-1 min-w-[130px] pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
            tab === "challenge"
              ? "border-brand text-brand shadow-sm"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          ⚡ Rapid-Fire
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 min-w-[110px] pb-3 text-center text-sm font-semibold border-b-2 transition-all ${
            tab === "leaderboard"
              ? "border-brand text-brand shadow-sm"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          👑 Leaderboard
        </button>
      </div>

      {/* Tab 1: Live Q&A */}
      {tab === "qa" && (
        <div className="space-y-5">
          {/* Ask Box */}
          <div className="rounded-2xl border bg-surface p-4 shadow-sm space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Ask a question..."
                className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
                maxLength={300}
              />
              <div className="flex gap-2">
                <button
                  onClick={improveDraft}
                  disabled={improving || !draft.trim()}
                  className="flex-1 sm:flex-initial rounded-xl border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50 shrink-0"
                >
                  {improving ? "✨ AI Magic..." : "✨ Improve"}
                </button>
                <button
                  onClick={submit}
                  disabled={!draft.trim()}
                  className="flex-1 sm:flex-initial rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50 shrink-0"
                >
                  Ask
                </button>
              </div>
            </div>
            {draft.length > 0 && (
              <div className="text-[11px] text-muted text-right pr-1">
                {draft.length}/300 chars
              </div>
            )}
          </div>

          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 Search questions..."
              className="w-full flex-1 rounded-xl border bg-surface px-4 py-2 text-sm outline-none placeholder:text-muted focus:border-brand"
            />
            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto border rounded-xl p-1 bg-surface">
              <button
                onClick={() => setSortBy("top")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === "top"
                    ? "bg-brand text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Top Voted
              </button>
              <button
                onClick={() => setSortBy("newest")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  sortBy === "newest"
                    ? "bg-brand text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Newest
              </button>
            </div>
          </div>

          {/* Questions List */}
          <ul className="space-y-3">
            {sortedQuestions.map((q) => (
              <li
                key={q.id}
                className="flex items-start gap-3.5 rounded-2xl border bg-surface p-4 shadow-sm transition-all hover:shadow-md"
              >
                <button
                  onClick={() => upvote(q.id)}
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border border-warm px-3.5 py-2 text-brand transition-all hover:border-brand hover:bg-brand-soft active:scale-95"
                  title="Upvote question"
                >
                  <span className="text-xs leading-none">▲</span>
                  <span className="text-sm font-bold leading-none tabular-nums">
                    {q.votes}
                  </span>
                </button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="leading-snug text-foreground font-medium">{q.body}</p>
                  {q.author && (
                    <p className="mt-1.5 text-xs text-muted">asked by {q.author}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {questions.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted">
              No questions found — be the first to ask!
            </p>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border bg-surface px-6 py-2.5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand disabled:opacity-50 shadow-sm"
              >
                {loading ? "Loading..." : "Load more questions"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Polls */}
      {tab === "polls" && (
        <div className="space-y-6">
          {loadingPolls && polls.length === 0 ? (
            <p className="text-center text-sm text-muted py-8">Loading polls...</p>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => {
                const hasVoted = poll.votedOptionId !== null;

                return (
                  <div key={poll.id} className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
                    <h3 className="text-lg font-semibold text-foreground leading-snug">
                      {poll.question}
                    </h3>
                    
                    <div className="space-y-3">
                      {poll.options?.map((option: any) => {
                        const isSelected = poll.votedOptionId === option.id;
                        const percent = poll.totalVotes > 0 
                          ? Math.round((option.votesCount / poll.totalVotes) * 100) 
                          : 0;

                        if (hasVoted) {
                          return (
                            <div
                              key={option.id}
                              className={`relative rounded-xl border p-3.5 flex items-center justify-between overflow-hidden transition-all ${
                                option.is_correct
                                  ? "border-amber-400/60 bg-amber-50/20"
                                  : isSelected
                                  ? "border-stone-400/60"
                                  : "border-warm"
                              }`}
                            >
                              <div 
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out -z-10 ${
                                  option.is_correct 
                                    ? "bg-amber-100/70" 
                                    : isSelected 
                                      ? "bg-stone-200/60" 
                                      : "bg-stone-100/40"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {option.text}
                                </span>
                                {option.is_correct && (
                                  <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                    ✓ Correct
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="border border-brand text-brand text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                    Your Choice
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-muted tabular-nums shrink-0">
                                {option.votesCount} ({percent}%)
                              </span>
                            </div>
                          );
                        } else {
                          return (
                            <button
                              key={option.id}
                              onClick={() => submitVote(poll.id, option.id)}
                              className="w-full text-left rounded-xl border border-warm px-4 py-3 text-sm font-medium hover:border-brand hover:bg-brand-soft hover:text-brand transition-all text-foreground active:scale-[0.99]"
                            >
                              {option.text}
                            </button>
                          );
                        }
                      })}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted pt-1">
                      <span>Total Votes: {poll.totalVotes}</span>
                      {hasVoted && (
                        <span className="font-bold text-brand">
                          {poll.options.find((o: any) => o.id === poll.votedOptionId)?.is_correct 
                            ? "✨ Correct! (+10 pts)" 
                            : "Incorrect (+0 pts)"
                          }
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {polls.length === 0 && (
                <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted">
                  No polls active right now. Create one below!
                </p>
              )}
            </div>
          )}

          {/* Create Poll Box */}
          <div className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              ➕ Create a New Poll
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Question</label>
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g. What is the average time complexity of Hash Table lookup?"
                  className="w-full rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted">
                  Options (select the radio button for the correct answer)
                </label>
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={correctOptionIdx === idx}
                      onChange={() => setCorrectOptionIdx(idx)}
                      className="accent-brand cursor-pointer w-4 h-4"
                      title="Mark as correct answer"
                    />
                    <input
                      value={option}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx] = e.target.value;
                        setPollOptions(newOpts);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => {
                          const newOpts = pollOptions.filter((_, i) => i !== idx);
                          setPollOptions(newOpts);
                          if (correctOptionIdx >= newOpts.length) {
                            setCorrectOptionIdx(0);
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 px-1 font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs text-brand font-semibold hover:underline block pt-1"
                  >
                    + Add option
                  </button>
                )}
              </div>

              <button
                onClick={createPoll}
                disabled={creatingPoll || !pollQuestion.trim()}
                className="w-full mt-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50 shadow-sm"
              >
                {creatingPoll ? "Publishing..." : "Publish Live Poll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: ⚡ Rapid-Fire Challenge */}
      {tab === "challenge" && (
        <div className="space-y-6">
          {challengeState === "idle" && (
            <div className="rounded-2xl border bg-surface p-6 shadow-sm text-center space-y-6">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl font-extrabold shadow-inner">
                ⚡
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-foreground">
                  Rapid-Fire Challenge
                </h3>
                <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                  Test your knowledge in a timed quiz mode! Answer one question at a time
                  before the 10-second timer expires.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2 text-center text-xs">
                <div className="p-3 rounded-xl border bg-background space-y-1">
                  <div className="font-bold text-foreground text-sm">⏱️ 10 sec</div>
                  <div className="text-muted">Per Question</div>
                </div>
                <div className="p-3 rounded-xl border bg-background space-y-1">
                  <div className="font-bold text-brand text-sm">+10 pts</div>
                  <div className="text-muted">Per Correct Choice</div>
                </div>
                <div className="p-3 rounded-xl border bg-background space-y-1">
                  <div className="font-bold text-foreground text-sm">✨ AI Tutor</div>
                  <div className="text-muted">Explain Answers</div>
                </div>
              </div>

              <button
                onClick={startChallenge}
                disabled={polls.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand text-white font-bold text-sm shadow-md hover:bg-brand-strong transition-all disabled:opacity-50"
              >
                {polls.length === 0 ? "Loading Quiz Questions..." : "🚀 Start Rapid-Fire Quiz"}
              </button>
            </div>
          )}

          {challengeState === "running" && polls[challengeIndex] && (
            <div className="rounded-2xl border bg-surface p-6 shadow-sm space-y-6">
              {/* Progress & Countdown Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Question {challengeIndex + 1} of {polls.length}
                </span>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm tabular-nums border-2 transition-colors ${
                      timeLeft <= 3
                        ? "border-rose-500 text-rose-600 bg-rose-50 animate-pulse"
                        : "border-amber-500 text-amber-600 bg-amber-50"
                    }`}
                  >
                    {timeLeft}s
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand h-full transition-all duration-300 ease-linear"
                  style={{ width: `${((challengeIndex + 1) / polls.length) * 100}%` }}
                />
              </div>

              {/* Question Text */}
              <h3 className="text-xl font-bold text-foreground leading-snug">
                {polls[challengeIndex].question}
              </h3>

              {/* Multiple Choice Options with Instant Visual Feedback */}
              <div className="space-y-3 pt-2">
                {polls[challengeIndex].options?.map((option: any) => {
                  const isSelected = selectedOptId === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(option.id)}
                      disabled={isTransitioning}
                      className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-semibold transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-brand bg-brand-soft/80 text-brand ring-2 ring-brand/30 shadow-md"
                          : isTransitioning
                          ? "border-warm opacity-60 cursor-not-allowed"
                          : "border-warm hover:border-brand hover:bg-brand-soft/40 hover:text-brand text-foreground active:scale-[0.99] cursor-pointer"
                      }`}
                    >
                      <span>{option.text}</span>
                      {isSelected ? (
                        <span className="text-xs font-bold bg-brand text-white px-2 py-0.5 rounded-md animate-pulse">
                          ✓ Selected
                        </span>
                      ) : (
                        <span className="text-xs text-muted font-normal">Select ➔</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {challengeState === "finished" && (
            <div className="space-y-6">
              {/* Score Summary Card */}
              <div className="rounded-2xl border bg-surface p-6 shadow-sm text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 text-2xl font-bold">
                  🏆
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-foreground">Challenge Complete!</h3>
                  <p className="text-sm text-muted mt-1">
                    You answered {correctCount} out of {challengeAnswers.length} questions correctly.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-brand tabular-nums">
                      +{totalPointsEarnedInChallenge} pts
                    </div>
                    <div className="text-xs font-medium text-muted">Points Earned</div>
                  </div>
                  <div className="h-8 w-px bg-warm" />
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-foreground tabular-nums">
                      {Math.round((correctCount / (challengeAnswers.length || 1)) * 100)}%
                    </div>
                    <div className="text-xs font-medium text-muted">Accuracy</div>
                  </div>
                </div>

                <button
                  onClick={startChallenge}
                  className="px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-strong transition-all shadow-sm"
                >
                  🔄 Play Again
                </button>
              </div>

              {/* Answers Review & Explain My Answer Section */}
              <div className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-foreground">Review Answers & AI Explanations</h4>

                <div className="space-y-4 divide-y divide-warm">
                  {challengeAnswers.map((record, index) => {
                    const expState = explanations[record.pollId];

                    return (
                      <div key={record.pollId} className="pt-4 first:pt-0 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-bold text-muted mr-2">Q{index + 1}</span>
                            <span className="text-sm font-semibold text-foreground">
                              {record.question}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                              record.isCorrect
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {record.isCorrect ? "✓ Correct (+10 pts)" : "✗ Incorrect"}
                          </span>
                        </div>

                        {/* Answer Choices summary */}
                        <div className="text-xs space-y-1 bg-background p-3 rounded-xl border">
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Your Answer:</span>
                            <span className={`font-semibold ${record.isCorrect ? "text-emerald-700" : "text-rose-600"}`}>
                              {record.optionSelectedText || "No answer (Time expired)"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Correct Answer:</span>
                            <span className="font-semibold text-foreground">
                              {record.correctOptionText}
                            </span>
                          </div>
                        </div>

                        {/* ✨ Explain My Answer Button */}
                        <div>
                          {!expState?.text && (
                            <button
                              onClick={() => fetchExplanation(record)}
                              disabled={expState?.loading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/40 bg-brand-soft/40 text-brand font-semibold text-xs hover:bg-brand-soft transition-all disabled:opacity-50"
                            >
                              {expState?.loading ? "✨ Generating AI Explanation..." : "✨ Explain My Answer"}
                            </button>
                          )}

                          {/* AI Explanation Card */}
                          {expState?.text && (
                            <div className="mt-2 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-stone-800 space-y-1 animate-fadeIn">
                              <div className="font-bold text-amber-900 flex items-center gap-1">
                                <span>🤖 Gemini AI Explanation:</span>
                              </div>
                              <p className="leading-relaxed">{expState.text}</p>
                            </div>
                          )}

                          {expState?.error && (
                            <p className="mt-1 text-xs text-rose-600 font-medium">
                              {expState.error}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Leaderboard */}
      {tab === "leaderboard" && (
        <div className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">👑 Top Participants</h3>
            <button
              onClick={fetchLeaderboard}
              className="text-xs font-semibold text-brand hover:underline"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingLeaderboard && leaderboard.length === 0 ? (
            <p className="text-center text-sm text-muted py-8">Loading rankings...</p>
          ) : (
            <div className="divide-y divide-warm">
              {leaderboard.map((player, index) => {
                const isCurrentUser = player.voter_id === voterId;
                const rank = index + 1;

                return (
                  <div
                    key={player.voter_id}
                    className={`flex items-center justify-between py-3 px-3 rounded-xl transition-all ${
                      isCurrentUser 
                        ? "bg-brand-soft/50 border border-brand/30 font-bold" 
                        : "hover:bg-background/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 text-center text-sm font-bold ${
                        rank === 1 ? "text-amber-500 text-base" : rank === 2 ? "text-stone-400 text-base" : rank === 3 ? "text-amber-700 text-base" : "text-muted"
                      }`}>
                        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                      </span>
                      <span className="text-sm text-foreground font-medium">
                        {player.username}
                        {isCurrentUser && (
                          <span className="ml-2 text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand/20">
                            YOU
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-brand tabular-nums">
                      {player.points} pts
                    </span>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <p className="p-8 text-center text-sm text-muted">
                  No points recorded yet. Be the first to answer a poll correctly!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
