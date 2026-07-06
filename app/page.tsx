import { AppShell } from "@/components/layout/AppShell";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default function Home() {
  return (
    <AppShell>
      <ChatLayout />
    </AppShell>
  );
}
