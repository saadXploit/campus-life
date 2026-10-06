import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/auth/guards";

export default async function Home() {
  const user = await getCurrentUser();
  return <Landing signedIn={Boolean(user)} />;
}