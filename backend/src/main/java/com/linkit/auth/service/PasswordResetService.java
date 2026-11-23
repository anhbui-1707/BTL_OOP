package com.linkit.auth.service;

import com.linkit.common.ApiException;
import com.linkit.identity.entity.User;
import com.linkit.identity.repository.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Locale;

@Service
public class PasswordResetService {
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final JavaMailSender mail;
    private final PasswordEncoder encoder;
    private final String secret;
    private final String from;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(
            UserRepository users,
            JdbcTemplate jdbc,
            JavaMailSender mail,
            PasswordEncoder encoder,
            @Value("${linkit.jwt.secret}") String secret,
            @Value("${linkit.mail.from}") String from) {
        this.users = users;
        this.jdbc = jdbc;
        this.mail = mail;
        this.encoder = encoder;
        this.secret = secret;
        this.from = from;
    }

    @Transactional
    public void request(String email) {
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        User user = users.findByEmailIgnoreCase(normalized).orElse(null);
        if (user == null || user.getStatus() != User.Status.ACTIVE) return;
        Instant now = Instant.now();
        Integer recent =
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.password_reset_codes WHERE user_id=? AND created_at>?",
                        Integer.class,
                        user.getId(),
                        Timestamp.from(now.minusSeconds(60)));
        if (recent != null && recent > 0) return;
        Integer hourly =
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.password_reset_codes WHERE user_id=? AND created_at>?",
                        Integer.class,
                        user.getId(),
                        Timestamp.from(now.minusSeconds(3600)));
        if (hourly != null && hourly >= 5) return;
        String code = String.format("%06d", random.nextInt(1_000_000));
        byte[] hash = digest(user.getId(), code);
        jdbc.update(
                "UPDATE dbo.password_reset_codes SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL",
                Timestamp.from(now),
                user.getId());
        jdbc.update(
                "INSERT INTO dbo.password_reset_codes(user_id,code_hash,expires_at,created_at) VALUES(?,?,?,?)",
                user.getId(),
                hash,
                Timestamp.from(now.plusSeconds(600)),
                Timestamp.from(now));
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(user.getEmail());
        message.setSubject("LinkIT - Ma xac minh dat lai mat khau");
        message.setText(
                "Ma xac minh LinkIT cua ban: "
                        + code
                        + "\nMa co hieu luc trong 10 phut. Khong chia se ma nay voi bat ky ai.");
        try {
            mail.send(message);
        } catch (MailException error) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "MAIL_UNAVAILABLE",
                    "Không thể gửi email lúc này. Vui lòng thử lại sau.");
        }
    }

    public void confirm(String email, String code, String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_FAILED",
                    "Mật khẩu không được vượt quá 72 byte UTF-8.");
        User user =
                users.findByEmailIgnoreCase(email.strip().toLowerCase(Locale.ROOT)).orElse(null);
        if (user == null || user.getStatus() != User.Status.ACTIVE) throw invalid();
        var records =
                jdbc.query(
                        "SELECT TOP (1) id,code_hash,expires_at,attempts FROM dbo.password_reset_codes WHERE user_id=? AND consumed_at IS NULL ORDER BY created_at DESC",
                        (rs, row) ->
                                new CodeRecord(
                                        rs.getLong("id"),
                                        rs.getBytes("code_hash"),
                                        rs.getTimestamp("expires_at").toInstant(),
                                        rs.getInt("attempts")),
                        user.getId());
        if (records.isEmpty()) throw invalid();
        CodeRecord record = records.get(0);
        if (record.attempts() >= 5 || !record.expiresAt().isAfter(Instant.now())) throw invalid();

        int changed =
                jdbc.update(
                        "UPDATE dbo.password_reset_codes SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND attempts<5",
                        record.id());
        if (changed != 1) throw invalid();
        if (!MessageDigest.isEqual(record.hash(), digest(user.getId(), code))) throw invalid();
        Instant now = Instant.now();
        jdbc.update(
                "UPDATE dbo.password_reset_codes SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL",
                Timestamp.from(now),
                user.getId());
        user.setPasswordHash(encoder.encode(password));
        user.setUpdatedAt(now);
        users.save(user);
        jdbc.update(
                "UPDATE dbo.refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
                Timestamp.from(now),
                user.getId());
    }

    private ApiException invalid() {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_RESET_CODE",
                "Mã không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.");
    }

    private byte[] digest(Long id, String code) {
        try {
            var sha = MessageDigest.getInstance("SHA-256");
            return sha.digest((secret + ":" + id + ":" + code).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private record CodeRecord(long id, byte[] hash, Instant expiresAt, int attempts) {}
}
