"use client";
import { useState, useEffect } from "react";
import { getVoterId } from "@/lib/voter";

type Question = {
  id: string;
  body: string;
  author: string | null;
  votes: number;
};

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  // Tabs state
  const [tab, setTab] = useState<"qa" | "polls" | "leaderboard">("qa");

  // Voter profile state
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

  // AI state
  const [improving, setImproving] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // Fetch profile on hydration
  useEffect(() => {
    if (hydrated) {
      fetchProfile();
    }
  }, [hydrated]);

  // Fetch tab specific data
  useEffect(() => {
    if (!hydrated) return;
    if (tab === "polls") {
      fetchPolls();
    } else if (tab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [tab, hydrated]);

  // Profile endpoints
  async function fetchProfile() {
    try {
      const res = await fetch(`/api/voters?voterId=${getVoterId()}`);
      if (res.ok) {
        const data = await res.json();
        setUsername(data.username || "Anonymous Voter");
        setPoints(data.points ?? 0);
        setNameInput(data.username || "Anonymous Voter");
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  }

  async function saveUsername() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: getVoterId(), username: trimmed }),
      });
      if (res.ok) {
        setUsername(trimmed);
        setEditingName(false);
        if (tab === "leaderboard") {
          fetchLeaderboard();
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save username");
      }
    } catch (err) {
      console.error("Failed to save username", err);
    }
  }

  // Q&A search query
  useEffect(() => {
    const id = setTimeout(async () => {
      const url = query
        ? `/api/questions?q=${encodeURIComponent(query)}`
        : `/api/questions`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data.questions || []);
      setHasMore(data.hasMore ?? false);
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  // Q&A actions
  async function submit() {
    if (!draft.trim()) return;

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, author: username }),
    });
    const created = await res.json();

    setQuestions((qs) => [{ ...created, votes: 0 }, ...qs]);
    setDraft("");
  }

  async function upvote(id: string) {
    // optimistic
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, votes: q.votes + 1 } : q))
    );

    const res = await fetch(`/api/questions/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId: getVoterId() }),
    });

    if (!res.ok) {
      setQuestions((qs) =>
        qs.map((q) => (q.id === id ? { ...q, votes: q.votes - 1 } : q))
      );
    }
  }

  async function loadMore() {
    setLoading(true);
    const res = await fetch(`/api/questions?offset=${questions.length}`);
    const data = await res.json();
    setQuestions((qs) => [...qs, ...(data.questions || [])]);
    setHasMore(data.hasMore ?? false);
    setLoading(false);
  }

  // AI draft improvement
  async function improveDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
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
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to improve question draft");
      }
    } catch (err) {
      console.error("Failed to improve question draft", err);
    } finally {
      setImproving(false);
    }
  }

  // Polls actions
  async function fetchPolls() {
    setLoadingPolls(true);
    try {
      const res = await fetch(`/api/polls?voterId=${getVoterId()}`);
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch (err) {
      console.error("Failed to fetch polls", err);
    } finally {
      setLoadingPolls(false);
    }
  }

  async function submitVote(pollId: string, optionId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, voterId: getVoterId() }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.isCorrect) {
          alert("Correct! You earned 10 points!");
        } else {
          alert("Incorrect. Better luck next time!");
        }
        fetchPolls();
        fetchProfile();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to vote");
      }
    } catch (err) {
      console.error("Failed to submit vote", err);
    }
  }

  async function createPoll() {
    if (!pollQuestion.trim()) return;
    const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      alert("Please provide at least 2 options.");
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
        fetchPolls();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create poll");
      }
    } catch (err) {
      console.error("Failed to create poll", err);
    } finally {
      setCreatingPoll(false);
    }
  }

  // Leaderboard actions
  async function fetchLeaderboard() {
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
  }

  return (
    <div className="space-y-6">
      {/* Voter Profile Banner */}
      {hydrated && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-1 text-sm outline-none focus:border-brand"
                  maxLength={20}
                />
                <button
                  onClick={saveUsername}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-strong"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameInput(username);
                  }}
                  className="rounded-lg border px-3 py-1 text-xs text-muted hover:bg-brand-soft"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{username}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-muted hover:text-brand"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <span>Score: {points} pts</span>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-warm">
        <button
          onClick={() => setTab("qa")}
          className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-colors ${
            tab === "qa"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Live Q&A
        </button>
        <button
          onClick={() => setTab("polls")}
          className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-colors ${
            tab === "polls"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Live Polls
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-colors ${
            tab === "leaderboard"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* Tab Contents: Live Q&A */}
      {tab === "qa" && (
        <div className="space-y-5">
          {/* Ask box */}
          <div className="rounded-2xl border bg-surface p-4 shadow-sm">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Ask a question…"
                className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
              />
              <button
                onClick={improveDraft}
                disabled={improving || !draft.trim()}
                className="rounded-xl border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50 shrink-0"
              >
                {improving ? "Improving..." : "Improve"}
              </button>
              <button
                onClick={submit}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-strong shrink-0"
              >
                Ask
              </button>
            </div>
          </div>

          {/* Search + hydration status */}
          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              className="w-full flex-1 rounded-xl border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
            />
            <span className="shrink-0 text-xs text-muted">
              {hydrated ? "Interactive" : "Loading interactivity..."}
            </span>
          </div>

          {/* Questions List */}
          <ul className="space-y-3">
            {questions.map((q) => (
              <li
                key={q.id}
                className="flex items-start gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  onClick={() => upvote(q.id)}
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3.5 py-2 text-brand transition-colors hover:border-brand hover:bg-brand-soft"
                >
                  <span className="text-xs leading-none">▲</span>
                  <span className="text-sm font-semibold leading-none tabular-nums">
                    {q.votes}
                  </span>
                </button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="leading-snug">{q.body}</p>
                  {q.author && (
                    <p className="mt-1.5 text-xs text-muted">asked by {q.author}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {questions.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted">
              No questions yet — be the first to ask.
            </p>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Live Polls */}
      {tab === "polls" && (
        <div className="space-y-6">
          {loadingPolls && polls.length === 0 ? (
            <p className="text-center text-sm text-muted">Loading polls...</p>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => {
                const hasVoted = poll.votedOptionId !== null;

                return (
                  <div key={poll.id} className="rounded-2xl border bg-surface p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">{poll.question}</h3>
                    
                    <div className="space-y-3">
                      {poll.options?.map((option: any) => {
                        const isSelected = poll.votedOptionId === option.id;
                        const percent = poll.totalVotes > 0 
                          ? Math.round((option.votesCount / poll.totalVotes) * 100) 
                          : 0;

                        if (hasVoted) {
                          // Show results view
                          return (
                            <div key={option.id} className="relative rounded-xl border p-3.5 flex items-center justify-between overflow-hidden">
                              {/* Progress bar background */}
                              <div 
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-500 -z-10 ${
                                  option.is_correct 
                                    ? "bg-amber-100 dark:bg-amber-950/40" 
                                    : isSelected 
                                      ? "bg-stone-100 dark:bg-stone-800/40" 
                                      : "bg-stone-50/50 dark:bg-stone-900/10"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{option.text}</span>
                                {option.is_correct && (
                                  <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Correct Answer
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="border border-brand text-brand text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Your Vote
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-muted">
                                {option.votesCount} ({percent}%)
                              </span>
                            </div>
                          );
                        } else {
                          // Show interactive voting buttons
                          return (
                            <button
                              key={option.id}
                              onClick={() => submitVote(poll.id, option.id)}
                              className="w-full text-left rounded-xl border px-4 py-3 text-sm font-medium hover:border-brand hover:bg-brand-soft hover:text-brand transition-colors text-foreground"
                            >
                              {option.text}
                            </button>
                          );
                        }
                      })}
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between text-xs text-muted">
                      <span>Total Votes: {poll.totalVotes}</span>
                      {hasVoted && (
                        <span className="font-semibold text-brand">
                          {poll.options.find((o: any) => o.id === poll.votedOptionId)?.is_correct 
                            ? "Correct! (+10 pts)" 
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
                  No polls active yet.
                </p>
              )}
            </div>
          )}

          {/* Create Poll Panel */}
          <div className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
            <h3 className="text-md font-semibold text-foreground">Create a New Poll</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Question</label>
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g. What does CPU stand for?"
                  className="w-full rounded-xl border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted">Options & Correct Answer</label>
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={correctOptionIdx === idx}
                      onChange={() => setCorrectOptionIdx(idx)}
                      className="accent-brand cursor-pointer"
                      title="Mark as correct option"
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
                        className="text-xs text-red-500 hover:text-red-700 px-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="text-xs text-brand font-medium hover:underline block"
                >
                  + Add option
                </button>
              </div>

              <button
                onClick={createPoll}
                disabled={creatingPoll || !pollQuestion.trim()}
                className="w-full mt-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {creatingPoll ? "Creating..." : "Publish Poll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: Leaderboard */}
      {tab === "leaderboard" && (
        <div className="rounded-2xl border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Top Scorers</h3>
            <button
              onClick={fetchLeaderboard}
              className="text-xs text-brand hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingLeaderboard && leaderboard.length === 0 ? (
            <p className="text-center text-sm text-muted">Loading leaderboard...</p>
          ) : (
            <div className="divide-y divide-warm">
              {leaderboard.map((player, index) => {
                const isCurrentUser = player.voter_id === getVoterId();
                const rank = index + 1;

                return (
                  <div
                    key={player.voter_id}
                    className={`flex items-center justify-between py-3 px-2 rounded-xl transition-colors ${
                      isCurrentUser 
                        ? "bg-brand-soft/40 border border-brand/20 font-bold" 
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm font-semibold text-center text-muted">
                        {rank}
                      </span>
                      <span className="text-sm text-foreground">
                        {player.username}
                        {isCurrentUser && <span className="ml-1.5 text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded-full">YOU</span>}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-brand tabular-nums">
                      {player.points} pts
                    </span>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <p className="p-8 text-center text-sm text-muted">
                  No scores recorded yet. Be the first to vote on a poll!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
