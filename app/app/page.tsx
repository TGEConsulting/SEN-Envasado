import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getSession } from "@/lib/auth";

export const metadata = { title: "SEN · Tablero" };
export const dynamic = "force-dynamic";

export default async function AppPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  return <Shell role={s.role} meId={s.uid} />;
}
