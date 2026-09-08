// In-memory fallback data store when Supabase network/DNS is unreachable or unconfigured.

export type MemoryQuestion = {
  id: string;
  body: string;
  author: string | null;
  votes: number;
  votedUsers: Set<string>;
  created_at: string;
};

export type MemoryPollOption = {
  id: string;
  text: string;
  is_correct: boolean;
  votesCount: number;
};

export type MemoryPoll = {
  id: string;
  question: string;
  created_at: string;
  options: MemoryPollOption[];
  voterResponses: Map<string, string>; // voter_id -> option_id
};

export type MemoryVoter = {
  voter_id: string;
  username: string;
  points: number;
};

class MemoryStore {
  questions: MemoryQuestion[] = [
    {
      id: "q1",
      body: "How do I deploy to Vercel?",
      author: "Priya",
      votes: 12,
      votedUsers: new Set(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "q2",
      body: "What's the difference between server and client components?",
      author: "Marcus",
      votes: 8,
      votedUsers: new Set(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "q3",
      body: "When should I add a database index?",
      author: "Aisha",
      votes: 5,
      votedUsers: new Set(),
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: "q4",
      body: "How does Postgres full-text search work?",
      author: "Diego",
      votes: 3,
      votedUsers: new Set(),
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: "q5",
      body: "Why did my in-memory data vanish on restart?",
      author: "Lena",
      votes: 2,
      votedUsers: new Set(),
      created_at: new Date(Date.now() - 18000000).toISOString(),
    },
  ];

  polls: MemoryPoll[] = [
    {
      id: "p1",
      question: "Which Next.js routing model is used in our project?",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      voterResponses: new Map(),
      options: [
        { id: "p1-opt1", text: "Pages Router", is_correct: false, votesCount: 2 },
        { id: "p1-opt2", text: "App Router", is_correct: true, votesCount: 15 },
        { id: "p1-opt3", text: "Both Pages and App Router", is_correct: false, votesCount: 1 },
      ],
    },
    {
      id: "p2",
      question: "What is the average time complexity of looking up an item in a Hash Table?",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      voterResponses: new Map(),
      options: [
        { id: "p2-opt1", text: "O(1)", is_correct: true, votesCount: 18 },
        { id: "p2-opt2", text: "O(log n)", is_correct: false, votesCount: 3 },
        { id: "p2-opt3", text: "O(n)", is_correct: false, votesCount: 1 },
      ],
    },
  ];

  voters: Map<string, MemoryVoter> = new Map([
    ["v1", { voter_id: "v1", username: "Priya", points: 30 }],
    ["v2", { voter_id: "v2", username: "Marcus", points: 20 }],
    ["v3", { voter_id: "v3", username: "Aisha", points: 10 }],
  ]);

  // Questions methods
  getQuestionsPage(offset: number, limit: number) {
    const sorted = [...this.questions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const sliced = sorted.slice(offset, offset + limit);
    const hasMore = sorted.length > offset + limit;
    return {
      questions: sliced.map((q) => ({ id: q.id, body: q.body, author: q.author, votes: q.votes })),
      hasMore,
    };
  }

  searchQuestions(q: string, limit: number) {
    const term = q.toLowerCase();
    const filtered = this.questions.filter((item) => item.body.toLowerCase().includes(term));
    return filtered.slice(0, limit).map((item) => ({
      id: item.id,
      body: item.body,
      author: item.author,
      votes: item.votes,
    }));
  }

  addQuestion(body: string, author: string | null) {
    const newQ: MemoryQuestion = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      body,
      author: author || "Anonymous",
      votes: 0,
      votedUsers: new Set(),
      created_at: new Date().toISOString(),
    };
    this.questions.unshift(newQ);
    return { id: newQ.id, body: newQ.body, author: newQ.author, created_at: newQ.created_at };
  }

  upvoteQuestion(questionId: string, voterId: string) {
    const q = this.questions.find((item) => item.id === questionId);
    if (!q) return { error: "Question not found", status: 404 };
    if (voterId && q.votedUsers.has(voterId)) {
      return { error: "already voted", status: 409 };
    }
    if (voterId) q.votedUsers.add(voterId);
    q.votes += 1;
    return { ok: true };
  }

  // Polls methods
  getPolls(voterId: string | null) {
    return this.polls.map((p) => {
      const votedOptId = voterId ? p.voterResponses.get(voterId) || null : null;
      const hasVoted = votedOptId !== null;
      const totalVotes = p.options.reduce((acc, opt) => acc + opt.votesCount, 0);

      const options = p.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votesCount: opt.votesCount,
        is_correct: hasVoted ? opt.is_correct : undefined,
      }));

      return {
        id: p.id,
        question: p.question,
        created_at: p.created_at,
        options,
        votedOptionId: votedOptId,
        totalVotes,
      };
    });
  }

  createPoll(question: string, options: { text: string; is_correct: boolean }[]) {
    const pollId = "p_" + Date.now();
    const pollOptions: MemoryPollOption[] = options.map((opt, idx) => ({
      id: `${pollId}_opt_${idx + 1}`,
      text: opt.text,
      is_correct: opt.is_correct,
      votesCount: 0,
    }));

    const newPoll: MemoryPoll = {
      id: pollId,
      question,
      created_at: new Date().toISOString(),
      options: pollOptions,
      voterResponses: new Map(),
    };
    this.polls.unshift(newPoll);
    return { id: pollId, question };
  }

  votePoll(pollId: string, optionId: string, voterId: string) {
    const poll = this.polls.find((p) => p.id === pollId);
    if (!poll) return { error: "Poll not found", status: 404 };

    if (poll.voterResponses.has(voterId)) {
      return { error: "You have already voted on this poll", status: 409 };
    }

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return { error: "Invalid option", status: 400 };

    poll.voterResponses.set(voterId, optionId);
    option.votesCount += 1;

    const pointsAwarded = option.is_correct ? 10 : 0;
    if (pointsAwarded > 0) {
      this.incrementVoterPoints(voterId, pointsAwarded);
    }

    return { ok: true, isCorrect: option.is_correct, pointsAwarded };
  }

  // Voter & Leaderboard methods
  getVoter(voterId: string) {
    const v = this.voters.get(voterId);
    if (!v) {
      return { username: "Anonymous Voter", points: 0 };
    }
    return { username: v.username, points: v.points };
  }

  registerVoter(voterId: string, username: string) {
    const existing = this.voters.get(voterId);
    if (existing) {
      existing.username = username;
    } else {
      this.voters.set(voterId, { voter_id: voterId, username, points: 0 });
    }
    return { ok: true };
  }

  incrementVoterPoints(voterId: string, points: number) {
    const existing = this.voters.get(voterId);
    if (existing) {
      existing.points += points;
    } else {
      this.voters.set(voterId, { voter_id: voterId, username: "Anonymous Voter", points });
    }
  }

  getLeaderboard() {
    const list = Array.from(this.voters.values());
    list.sort((a, b) => b.points - a.points);
    return list.slice(0, 50);
  }
}

export const memoryStore = new MemoryStore();
