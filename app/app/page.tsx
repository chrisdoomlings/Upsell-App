import { redirect } from "next/navigation";

export default function EmbeddedAppHomePage() {
  redirect("/app/dashboard");
}
