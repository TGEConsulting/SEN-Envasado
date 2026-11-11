import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "SEN · Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/app");
  return <LoginForm />;
}
