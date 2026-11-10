export type SandboxReview = { path: string; startMs: number; french: boolean };
export function hasConfirmedFrench(
  path: string,
  review?: SandboxReview | null,
) {
  return review?.path === path && review.french === true;
}

export function sandboxTiming(
  path: string,
  startMs: number,
  usableMs: number,
  review?: SandboxReview | null,
) {
  const endMs = startMs + usableMs;
  const adjusted = review?.path === path ? review.startMs : startMs;
  return { startMs: adjusted, usableMs: endMs - adjusted };
}
