import { AppShell } from "@/components/layout/AppShell";
import { ChatView } from "@/components/chat/ChatView";

export default function Home() {
  return (
    <AppShell>
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        <ChatView />
      </div>
    </AppShell>
  );
}
