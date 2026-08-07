import { NextRequest, NextResponse } from "next/server";
import { microsoftGraphFetch, type MicrosoftTodoList, type MicrosoftTodoTask } from "@/lib/microsoft-client";
import { getServerCached, setServerCached, invalidateServerCachePattern } from "@/lib/server-cache";
import { safeErrorMessage } from "@/lib/utils";
import { requireSession } from "@/lib/session";

export type { MicrosoftTodoList, MicrosoftTodoTask };

const TODO_LIST_CACHE_KEY = "todo:lists";
const TODO_TASKS_CACHE_KEY = "todo:tasks";
const TODO_TTL_MS = 2 * 60 * 1000;

// Réponse Graph paginée (max 100 items par page)
type GraphListResponse<T> = { value: T[]; "@odata.nextLink"?: string };

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const listId = request.nextUrl.searchParams.get("listId");
  const top = request.nextUrl.searchParams.get("top") ?? "50";

  try {
    if (listId) {
      const cacheKey = `${TODO_TASKS_CACHE_KEY}:${listId}:${top}`;
      const cached = getServerCached<{ tasks: MicrosoftTodoTask[] }>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }

      const data = await microsoftGraphFetch<GraphListResponse<MicrosoftTodoTask>>(
        `/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=${top}&$orderby=createdDateTime`
      );
      const response = { tasks: data.value };
      setServerCached(cacheKey, response, TODO_TTL_MS);
      return NextResponse.json(response);
    }

    const cached = getServerCached<{ lists: MicrosoftTodoList[] }>(TODO_LIST_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const data = await microsoftGraphFetch<GraphListResponse<MicrosoftTodoList>>(
      "/me/todo/lists?$top=100"
    );
    const response = { lists: data.value };
    setServerCached(TODO_LIST_CACHE_KEY, response, TODO_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/todo] error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}

// Marque une tâche comme terminée (pattern du POST gmail : invalidation du cache).
export async function PATCH(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { listId: string; taskId: string; completed?: boolean };
    if (!body.listId || !body.taskId) {
      return NextResponse.json({ error: "listId et taskId requis" }, { status: 400 });
    }

    const status = body.completed === false ? "notStarted" : "completed";
    await microsoftGraphFetch<unknown>(
      `/me/todo/lists/${encodeURIComponent(body.listId)}/tasks/${encodeURIComponent(body.taskId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );

    invalidateServerCachePattern(/^todo:tasks/);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/todo PATCH] error:", err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
