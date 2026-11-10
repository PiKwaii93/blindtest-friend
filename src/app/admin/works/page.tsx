import { Admin } from "@/components/admin";
import { videoSandboxEnabled } from "@/server/video-sandbox";
export default function Page() {
  return <Admin videoSandbox={videoSandboxEnabled()} />;
}
