import Link from "next/link";
import { requireAdmin } from "@/server/supabase";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    return (
      <main>
        <div className="notice">
          Cet espace est réservé aux administrateurs.{" "}
          <Link href="/login" className="link">
            Connexion
          </Link>
        </div>
      </main>
    );
  }
  return children;
}
