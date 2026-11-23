import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../../api/auth";
import { savedJobsApi, type SavedJobRecord } from "../../api/savedJobs";
import { getSessionSnapshot, sessionGeneration } from "../../auth/session";

interface SavedState {
  key: string | null;
  records: SavedJobRecord[];
  ready: boolean;
  loading: boolean;
  error: string;
  pending: string[];
}

const empty: SavedState = {
  key: null,
  records: [],
  ready: false,
  loading: false,
  error: "",
  pending: [],
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thể cập nhật việc làm đã lưu.";

export default function useSavedJobs(user: AuthUser | null) {
  const generation = sessionGeneration();
  const key = user?.roles.includes("FREELANCER")
    ? `${user.id}:${generation}`
    : null;
  const scope = useRef(key);
  scope.current = key;
  const [state, setState] = useState<SavedState>(empty);
  const currentState = useRef(state);
  currentState.current = state;
  const locks = useRef(new Set<string>());
  const request = useRef(0);
  const refreshing = useRef(false);
  const refreshPending = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!key) return;
    if ([...locks.current].some((lock) => lock.startsWith(key + "/"))) {
      refreshPending.current = true;
      return;
    }
    const serial = ++request.current;
    refreshing.current = true;
    refreshPending.current = false;
    setState((previous) => ({
      ...(previous.key === key ? previous : empty),
      key,
      loading: true,
      error: "",
    }));
    try {
      const records = await savedJobsApi.list();
      if (
        scope.current !== key ||
        generation !== sessionGeneration() ||
        serial !== request.current
      )
        return;
      setState({
        key,
        records,
        ready: true,
        loading: false,
        error: "",
        pending: [],
      });
    } catch (error) {
      if (
        scope.current !== key ||
        generation !== sessionGeneration() ||
        serial !== request.current
      )
        return;
      setState((previous) => ({
        ...previous,
        key,
        loading: false,
        error: message(error),
      }));
    } finally {
      if (serial === request.current) refreshing.current = false;
    }
  }, [key, generation]);

  useEffect(() => {
    if (!key) {
      setState(empty);
      return;
    }
    void refresh();
    const reload = () => {
      void refresh();
    };
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    try {
      channel.current = new BroadcastChannel("linkit-saved-jobs");
      channel.current.onmessage = (event) => {
        if (event.data?.userId === user?.id) reload();
      };
    } catch {}
    return () => {
      request.current++;
      refreshing.current = false;
      refreshPending.current = false;
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      channel.current?.close();
      channel.current = null;
    };
  }, [key, refresh, user?.id]);

  const toggle = async (rawId: string): Promise<boolean> => {
    const id = Number(rawId);
    const snapshot = currentState.current;
    const lock = key + "/" + rawId;
    if (
      !key ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      snapshot.key !== key ||
      !snapshot.ready ||
      snapshot.loading ||
      refreshing.current ||
      locks.current.has(lock)
    )
      return false;
    if (
      getSessionSnapshot().user?.id !== user?.id ||
      sessionGeneration() !== generation
    )
      return false;
    locks.current.add(lock);
    const saved = snapshot.records.some((record) => record.jobId === id);
    setState((previous) => ({
      ...previous,
      error: "",
      pending: [...previous.pending, rawId],
    }));
    try {
      let record: SavedJobRecord | null = null;
      if (saved) await savedJobsApi.remove(id);
      else record = await savedJobsApi.save(id);
      if (scope.current !== key || generation !== sessionGeneration())
        return false;
      setState((previous) => ({
        ...previous,
        records: record
          ? [record, ...previous.records.filter((item) => item.jobId !== id)]
          : previous.records.filter((item) => item.jobId !== id),
      }));
      try {
        channel.current?.postMessage({ userId: user?.id });
      } catch {}
      return true;
    } catch (error) {
      if (scope.current === key && generation === sessionGeneration()) {
        setState((previous) => ({ ...previous, error: message(error) }));
      }
      return false;
    } finally {
      locks.current.delete(lock);
      if (scope.current === key && generation === sessionGeneration()) {
        setState((previous) => ({
          ...previous,
          pending: previous.pending.filter((item) => item !== rawId),
        }));
        if (refreshPending.current) void refresh();
      }
    }
  };

  const visible = state.key === key ? state : empty;
  const ids = useMemo(
    () => visible.records.map((record) => String(record.jobId)),
    [visible.records],
  );
  return {
    records: visible.records,
    ids,
    loading:
      Boolean(key) && (visible.loading || (!visible.ready && !visible.error)),
    error: visible.error,
    pending: visible.pending,
    ready: visible.ready,
    refresh,
    toggle,
  };
}
