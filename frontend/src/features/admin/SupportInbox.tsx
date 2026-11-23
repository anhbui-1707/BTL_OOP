import { useEffect, useState } from "react";
import { supportApi, type SupportRequest } from "../../api/support";

const statuses: Record<SupportRequest["status"], string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
};

export default function SupportInbox() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const active = items.find((item) => item.id === selected);
  const refresh = () => {
    setLoading(true);
    setError("");
    supportApi
      .list()
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Không thể tải yêu cầu"),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
  }, []);
  const update = async (
    item: SupportRequest,
    status: SupportRequest["status"],
  ) => {
    setBusy(item.id);
    try {
      await supportApi.update(item.id, status);
      setItems((rows) =>
        rows.map((row) => (row.id === item.id ? { ...row, status } : row)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật");
    } finally {
      setBusy(null);
    }
  };
  const sendReply = async (item: SupportRequest) => {
    const message = (replyText[item.id] || "").trim();
    if (!message || message.length > 4000 || busy !== null) return;
    setBusy(item.id);
    setError("");
    try {
      await supportApi.reply(item.id, message);
      setItems((rows) =>
        rows.map((row) =>
          row.id === item.id
            ? {
                ...row,
                adminReply: message,
                status: "RESOLVED",
                repliedAt: new Date().toISOString(),
              }
            : row,
        ),
      );
      setReplyText((values) => ({ ...values, [item.id]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi phản hồi");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="ad-panel">
      <div className="ad-panel-head">
        <h2>Yêu cầu liên hệ ({items.length})</h2>
        <button className="ad-button" onClick={refresh} disabled={loading}>
          Làm mới
        </button>
      </div>
      {error && (
        <p role="alert" className="ad-state ad-error">
          {error}
        </p>
      )}
      {loading ? (
        <p className="ad-state">Đang tải yêu cầu...</p>
      ) : items.length === 0 ? (
        <p className="ad-state">Chưa có yêu cầu liên hệ.</p>
      ) : (
        <div className="ad-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Người gửi</th>
                <th>Chủ đề</th>
                <th>Ngày gửi</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                  </td>
                  <td>
                    <strong>{item.subject}</strong>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                  <td>{statuses[item.status]}</td>
                  <td>
                    <button
                      type="button"
                      className="ad-button"
                      onClick={() => setSelected(item.id)}
                    >
                      {item.adminReply ? "Xem phản hồi" : "Xem và phản hồi"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {active && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && busy === null)
              setSelected(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.56)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-detail-title"
            style={{
              background: "#fff",
              color: "#152238",
              borderRadius: 18,
              width: "min(100%,680px)",
              maxHeight: "min(90vh,900px)",
              overflowY: "auto",
              boxShadow: "0 24px 70px rgba(15,23,42,.22)",
              padding: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <p
                  style={{ fontSize: 13, color: "#64748b", margin: "0 0 6px" }}
                >
                  CHI TIẾT YÊU CẦU HỖ TRỢ
                </p>
                <h2
                  id="support-detail-title"
                  style={{ fontSize: 22, lineHeight: 1.35, margin: 0 }}
                >
                  {active.subject}
                </h2>
              </div>
              <button
                type="button"
                className="ad-button"
                aria-label="Đóng"
                disabled={busy !== null}
                onClick={() => setSelected(null)}
              >
                Đóng
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 12,
                background: "#f4f7fb",
                marginBottom: 22,
              }}
            >
              <div style={{ flex: "1 1 230px" }}>
                <strong>{active.name}</strong>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  {active.email}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {new Date(active.createdAt).toLocaleString("vi-VN")}
              </div>
              <select
                aria-label="Trạng thái yêu cầu"
                value={active.status}
                disabled={busy !== null}
                onChange={(e) =>
                  void update(
                    active,
                    e.target.value as SupportRequest["status"],
                  )
                }
              >
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>
                Nội dung yêu cầu
              </h3>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  lineHeight: 1.7,
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fbfcfe",
                }}
              >
                {active.message}
              </div>
            </div>
            {active.adminReply && (
              <div style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>
                  Phản hồi đã gửi
                </h3>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    lineHeight: 1.7,
                    padding: 16,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #dbeafe",
                  }}
                >
                  {active.adminReply}
                </div>
              </div>
            )}
            {!active.adminReply && (
              <div>
                <label
                  htmlFor="support-reply-message"
                  style={{
                    display: "block",
                    fontWeight: 650,
                    marginBottom: 10,
                  }}
                >
                  Trả lời người gửi
                </label>
                <textarea
                  id="support-reply-message"
                  rows={5}
                  maxLength={4000}
                  value={replyText[active.id] ?? ""}
                  onChange={(e) =>
                    setReplyText((values) => ({
                      ...values,
                      [active.id]: e.target.value,
                    }))
                  }
                  placeholder="Nhập nội dung phản hồi..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    resize: "vertical",
                    font: "inherit",
                    lineHeight: 1.6,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 14,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {(replyText[active.id] || "").length}/4000 ký tự
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="ad-button"
                      disabled={busy !== null}
                      onClick={() => setSelected(null)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="ad-button"
                      disabled={
                        busy !== null || !(replyText[active.id] || "").trim()
                      }
                      onClick={() => void sendReply(active)}
                    >
                      {busy === active.id ? "Đang gửi..." : "Gửi phản hồi"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
