import type { Workspace } from "./model";
import { createDemoWorkspace } from "./fixtures";

export interface WorkspaceRepository {
  load(): Promise<Workspace>;
  save(value: Workspace): Promise<void>;
}
const KEY = "linkit-v2-isolated-demo-v1";
export const demoRepository: WorkspaceRepository = {
  async load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createDemoWorkspace();
    try {
      const saved = JSON.parse(raw);
      if (
        saved.schema !== 1 ||
        !saved.data?.job ||
        !Array.isArray(saved.data?.milestones) ||
        !Array.isArray(saved.data?.scopeHistory)
      )
        throw new Error();
      return saved.data as Workspace;
    } catch {
      throw new Error(
        "Bản demo đã lưu không hợp lệ. Hãy dùng nút “Tạo bản demo mới” để tiếp tục.",
      );
    }
  },
  async save(data) {
    localStorage.setItem(KEY, JSON.stringify({ schema: 1, data }));
  },
};
