package com.linkit.identity.service;

import com.linkit.auth.dto.AuthDtos.UserResponse;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.User;
import com.linkit.identity.repository.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;

import javax.imageio.ImageIO;

@Service
public class AvatarService {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final Path directory;
    private final UserRepository users;
    private final TransactionTemplate transactions;

    public AvatarService(
            @Value("${LINKIT_UPLOAD_DIR:uploads/avatars}") String uploadDir,
            UserRepository users,
            TransactionTemplate transactions) {
        this.directory = Path.of(uploadDir).toAbsolutePath().normalize();
        this.users = users;
        this.transactions = transactions;
    }

    public UserResponse upload(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES)
            throw invalid("Ảnh phải có dung lượng từ 1 byte đến 2 MB.");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw unavailable();
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw invalid("Ảnh vượt giới hạn 2 MB.");
        String extension = detect(bytes);
        String filename = UUID.randomUUID() + "." + extension;
        Path destination = directory.resolve(filename);
        try {
            Files.createDirectories(directory);
            Files.write(destination, bytes, StandardOpenOption.CREATE_NEW);
        } catch (IOException ex) {
            try {
                Files.deleteIfExists(destination);
            } catch (IOException ignored) {
            }
            throw unavailable();
        }
        try {
            return transactions.execute(
                    status -> {
                        User user =
                                users.findWithRolesById(userId)
                                        .orElseThrow(
                                                () ->
                                                        new ApiException(
                                                                HttpStatus.NOT_FOUND,
                                                                "USER_NOT_FOUND",
                                                                "Tài khoản không tồn tại."));
                        user.setAvatarUrl("/api/avatars/" + filename);
                        user.setUpdatedAt(Instant.now());
                        users.saveAndFlush(user);
                        return new UserResponse(
                                user.getId(),
                                user.getEmail(),
                                user.getFullName(),
                                user.getPhoneNumber(),
                                user.getAvatarUrl(),
                                user.getStatus(),
                                user.getRoles().stream()
                                        .map(role -> role.getId().getRole())
                                        .collect(java.util.stream.Collectors.toSet()));
                    });
        } catch (RuntimeException ex) {
            try {
                Files.deleteIfExists(destination);
            } catch (IOException ignored) {
            }
            throw ex;
        }
    }

    public byte[] read(String filename) {
        if (!filename.matches("[0-9a-fA-F-]{36}\\.(jpg|png|webp)"))
            throw new ApiException(HttpStatus.NOT_FOUND, "AVATAR_NOT_FOUND", "Ảnh không tồn tại.");
        try {
            return Files.readAllBytes(directory.resolve(filename));
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "AVATAR_NOT_FOUND", "Ảnh không tồn tại.");
        }
    }

    private static String detect(byte[] bytes) {
        String type;
        if (bytes.length >= 3
                && (bytes[0] & 255) == 255
                && (bytes[1] & 255) == 216
                && (bytes[2] & 255) == 255) type = "jpg";
        else if (bytes.length >= 8
                && (bytes[0] & 255) == 137
                && bytes[1] == 80
                && bytes[2] == 78
                && bytes[3] == 71
                && bytes[4] == 13
                && bytes[5] == 10
                && bytes[6] == 26
                && bytes[7] == 10) type = "png";
        else if (bytes.length >= 12
                && new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII)
                        .equals("RIFF")
                && new String(bytes, 8, 4, java.nio.charset.StandardCharsets.US_ASCII)
                        .equals("WEBP")) type = "webp";
        else throw invalid("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP hợp lệ.");
        if (type.equals("webp")) {
            if (bytes.length < 30) throw invalid("Nội dung ảnh không hợp lệ.");
            int declared =
                    (bytes[4] & 255)
                            | ((bytes[5] & 255) << 8)
                            | ((bytes[6] & 255) << 16)
                            | ((bytes[7] & 255) << 24);
            String chunk = new String(bytes, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
            int length =
                    (bytes[16] & 255)
                            | ((bytes[17] & 255) << 8)
                            | ((bytes[18] & 255) << 16)
                            | ((bytes[19] & 255) << 24);
            if (declared != bytes.length - 8
                    || length < 10
                    || length > bytes.length - 20
                    || (!chunk.equals("VP8 ") && !chunk.equals("VP8L") && !chunk.equals("VP8X")))
                throw invalid("Nội dung ảnh không hợp lệ.");
            if (chunk.equals("VP8X")) {
                if (length < 10) throw invalid("Nội dung ảnh không hợp lệ.");
                long width =
                        1L
                                + (bytes[24] & 255)
                                + ((bytes[25] & 255) << 8)
                                + ((bytes[26] & 255) << 16);
                long height =
                        1L
                                + (bytes[27] & 255)
                                + ((bytes[28] & 255) << 8)
                                + ((bytes[29] & 255) << 16);
                if (width * height > 25_000_000L) throw invalid("Kích thước ảnh không hợp lệ.");
            } else if (chunk.equals("VP8L")) {
                if ((bytes[20] & 255) != 47) throw invalid("Nội dung ảnh không hợp lệ.");
            } else if (bytes[23] != (byte) 0x9d
                    || bytes[24] != (byte) 0x01
                    || bytes[25] != (byte) 0x2a) {
                throw invalid("Nội dung ảnh không hợp lệ.");
            }
            return type;
        }
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null
                    || image.getWidth() < 1
                    || image.getHeight() < 1
                    || (long) image.getWidth() * image.getHeight() > 25_000_000L)
                throw invalid("Nội dung ảnh không hợp lệ.");
        } catch (IOException ex) {
            throw invalid("Nội dung ảnh không hợp lệ.");
        }
        return type;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_AVATAR", message);
    }

    private static ApiException unavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "AVATAR_STORAGE_UNAVAILABLE",
                "Không thể lưu ảnh lúc này.");
    }
}
