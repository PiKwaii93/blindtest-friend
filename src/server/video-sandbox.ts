import "server-only";

export function videoSandboxEnabled() {
  return (
    process.env.ENCORE_VIDEO_SANDBOX === "1" &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  );
}
