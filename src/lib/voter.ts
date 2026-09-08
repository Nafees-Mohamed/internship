export function getVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("voter_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("voter_id", id);
  }
  return id;
}

