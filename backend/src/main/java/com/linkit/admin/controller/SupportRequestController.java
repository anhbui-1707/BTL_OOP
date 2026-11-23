package com.linkit.admin.controller;

import com.linkit.auth.security.AuthPrincipal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
public class SupportRequestController {
    private final JdbcTemplate jdbc;

    public SupportRequestController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Submit(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 200) String subject,
            @NotBlank @Size(max = 4000) String message) {}

    public record Item(
            long id,
            String name,
            String email,
            String subject,
            String message,
            String status,
            LocalDateTime createdAt,
            String adminReply,
            LocalDateTime repliedAt) {}

    public record Update(@NotNull @Pattern(regexp = "NEW|IN_PROGRESS|RESOLVED") String status) {}

    public record Reply(@NotBlank @Size(max = 4000) String message) {}

    @PostMapping("/api/public/support-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public void submit(@Valid @RequestBody Submit input) {
        jdbc.update(
                "INSERT INTO dbo.support_requests(sender_name,sender_email,subject,message) VALUES (?,?,?,?)",
                input.name().strip(),
                input.email().strip(),
                input.subject().strip(),
                input.message().strip());
    }

    @PostMapping("/api/support-requests")
    @PreAuthorize("hasAnyRole('CLIENT','FREELANCER')")
    @ResponseStatus(HttpStatus.CREATED)
    public void submitAuthenticated(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody Submit input) {
        jdbc.update(
                "INSERT INTO dbo.support_requests(sender_name,sender_email,subject,message,sender_user_id) VALUES (?,?,?,?,?)",
                input.name().strip(),
                input.email().strip(),
                input.subject().strip(),
                input.message().strip(),
                actor.userId());
    }

    @GetMapping("/api/support-requests/me")
    @PreAuthorize("hasAnyRole('CLIENT','FREELANCER')")
    public List<Item> mine(@AuthenticationPrincipal AuthPrincipal actor) {
        return jdbc.query(
                "SELECT TOP (100) id,sender_name,sender_email,subject,message,status,created_at,admin_reply,replied_at FROM dbo.support_requests WHERE sender_user_id=? ORDER BY created_at DESC",
                (rs, n) -> map(rs),
                actor.userId());
    }

    @PostMapping("/api/admin/support-requests/{id}/reply")
    @PreAuthorize("hasRole('ADMIN')")
    public void reply(@PathVariable @Positive long id, @Valid @RequestBody Reply input) {
        int count =
                jdbc.update(
                        "UPDATE dbo.support_requests SET admin_reply=?,replied_at=SYSUTCDATETIME(),status='RESOLVED',updated_at=SYSUTCDATETIME() WHERE id=?",
                        input.message().strip(),
                        id);
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    private static Item map(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.sql.Timestamp replied = rs.getTimestamp("replied_at");
        return new Item(
                rs.getLong("id"),
                rs.getString("sender_name"),
                rs.getString("sender_email"),
                rs.getString("subject"),
                rs.getString("message"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getString("admin_reply"),
                replied == null ? null : replied.toLocalDateTime());
    }

    @GetMapping("/api/admin/support-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Item> list() {
        return jdbc.query(
                "SELECT TOP (200) id,sender_name,sender_email,subject,message,status,created_at,admin_reply,replied_at FROM dbo.support_requests ORDER BY created_at DESC",
                (rs, row) -> map(rs));
    }

    @PatchMapping("/api/admin/support-requests/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void update(@PathVariable @Positive long id, @Valid @RequestBody Update input) {
        int count =
                jdbc.update(
                        "UPDATE dbo.support_requests SET status=?, updated_at=SYSUTCDATETIME() WHERE id=?",
                        input.status(),
                        id);
        if (count == 0)
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND);
    }
}
