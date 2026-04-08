import { redirect } from "next/navigation";

/**
 * Root page — redirect to login.
 * Once authenticated, middleware will redirect to /home.
 */
export default function RootPage() {
  redirect("/login");
}
