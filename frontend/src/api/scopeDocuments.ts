import { apiFetchBlob, apiRequestWithMeta } from "./http";

export interface ScopeDocumentInfo {
  name: string;
  size: number;
}
const path = (assignmentId: number) =>
  `/api/assignments/${assignmentId}/scope-document`;

export const scopeDocumentsApi = {
  async info(id: number): Promise<ScopeDocumentInfo | null> {
    return (await apiRequestWithMeta<ScopeDocumentInfo | null>(path(id))).data;
  },
  async upload(id: number, file: File): Promise<ScopeDocumentInfo> {
    const body = new FormData();
    body.append("file", file);
    return (
      await apiRequestWithMeta<ScopeDocumentInfo>(path(id), {
        method: "POST",
        body,
      })
    ).data;
  },
  file: (id: number) => apiFetchBlob(path(id) + "/file"),
};
