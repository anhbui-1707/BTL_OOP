package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;

import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
public class ScopeDocumentController {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final JdbcTemplate db;

    public ScopeDocumentController(JdbcTemplate db) {
        this.db = db;
    }

    public record DocumentInfo(String name, int size) {}

    private String assignmentStatus(AuthPrincipal actor, Long assignmentId, boolean write) {
        if (actor == null)
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Vui lòng đăng nhập.");
        var matches =
                db.query(
                        write
                                ? "SELECT client_id, freelancer_id, status FROM dbo.assignments WITH (UPDLOCK,HOLDLOCK) WHERE id=?"
                                : "SELECT client_id, freelancer_id, status FROM dbo.assignments WHERE id=?",
                        (rs, row) ->
                                Map.of(
                                        "client",
                                        rs.getLong(1),
                                        "freelancer",
                                        rs.getLong(2),
                                        "status",
                                        rs.getString(3)),
                        assignmentId);
        if (matches.isEmpty()) throw missing();
        var assignment = matches.getFirst();
        boolean client =
                actor.roles().contains(Role.CLIENT)
                        && actor.userId().equals(assignment.get("client"));
        boolean freelancer =
                actor.roles().contains(Role.FREELANCER)
                        && actor.userId().equals(assignment.get("freelancer"));
        if (write ? !client : !(client || freelancer)) throw missing();
        return (String) assignment.get("status");
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "SCOPE_DOCUMENT_NOT_FOUND",
                "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.");
    }

    @GetMapping("/api/assignments/{id}/scope-document")
    public ResponseEntity<DocumentInfo> info(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable Long id) {
        assignmentStatus(actor, id, false);
        var rows =
                db.query(
                        "SELECT file_name, file_size FROM dbo.assignment_scope_documents WHERE assignment_id=?",
                        (rs, row) -> new DocumentInfo(rs.getString(1), rs.getInt(2)),
                        id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(rows.isEmpty() ? null : rows.getFirst());
    }

    @Transactional
    @PostMapping(
            path = "/api/assignments/{id}/scope-document",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentInfo> upload(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file)
            throws IOException {
        String status = assignmentStatus(actor, id, true);

        Integer submitted =
                db.queryForObject(
                        "SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=? AND status IN ('PENDING_APPROVAL','LOCKED')",
                        Integer.class,
                        id);
        if (submitted != null && submitted > 0)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "SCOPE_DOCUMENT_LOCKED",
                    "Phạm vi đã gửi xác nhận. Không thể thay đổi tài liệu PDF.");

        if (!status.equals("PENDING_SCOPE")) {
            Integer existing =
                    db.queryForObject(
                            "SELECT COUNT(*) FROM dbo.assignment_scope_documents WHERE assignment_id=?",
                            Integer.class,
                            id);
            if (existing == null || existing > 0 || status.equals("CANCELLED"))
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "SCOPE_DOCUMENT_LOCKED",
                        "Tài liệu đã khóa, không thể thay đổi.");
        }
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INVALID_SCOPE_PDF",
                    "PDF không được trống và tối đa 2 MB.");
        byte[] bytes = file.getBytes();
        if (bytes.length < 8
                || bytes.length > MAX_BYTES
                || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-"))
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INVALID_SCOPE_PDF",
                    "Tài liệu phải là PDF hợp lệ.");
        String name = file.getOriginalFilename();
        if (name == null) name = "Tai_lieu_pham_vi.pdf";
        name = name.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        if (!name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf") || name.length() > 255)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INVALID_SCOPE_PDF",
                    "Tên file PDF không hợp lệ.");
        int count =
                db.update(
                        "UPDATE dbo.assignment_scope_documents SET file_name=?,file_size=?,pdf_bytes=?,uploaded_by=?,uploaded_at=SYSUTCDATETIME() WHERE assignment_id=?",
                        name,
                        bytes.length,
                        bytes,
                        actor.userId(),
                        id);
        if (count == 0)
            db.update(
                    "INSERT INTO dbo.assignment_scope_documents(assignment_id,file_name,file_size,pdf_bytes,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,SYSUTCDATETIME())",
                    id,
                    name,
                    bytes.length,
                    bytes,
                    actor.userId());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new DocumentInfo(name, bytes.length));
    }

    @GetMapping("/api/assignments/{id}/scope-document/file")
    public ResponseEntity<byte[]> file(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean download) {
        assignmentStatus(actor, id, false);
        var rows =
                db.query(
                        "SELECT file_name,pdf_bytes FROM dbo.assignment_scope_documents WHERE assignment_id=?",
                        (rs, row) -> new StoredPdf(rs.getString(1), rs.getBytes(2)),
                        id);
        if (rows.isEmpty()) throw missing();
        var pdf = rows.getFirst();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.builder(download ? "attachment" : "inline")
                                .filename(pdf.name(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf.bytes());
    }

    private record StoredPdf(String name, byte[] bytes) {}
}
