package com.linkit.identity.controller;

import com.linkit.auth.dto.AuthDtos.UserResponse;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.service.AvatarService;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class AvatarController {
    private final AvatarService avatars;

    public AvatarController(AvatarService avatars) {
        this.avatars = avatars;
    }

    @PostMapping(path = "/api/users/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserResponse> upload(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(avatars.upload(principal.userId(), file));
    }

    @GetMapping("/api/avatars/{filename:.+}")
    public ResponseEntity<byte[]> read(@PathVariable String filename) {
        String extension = filename.substring(filename.lastIndexOf('.') + 1);
        MediaType type =
                extension.equals("jpg")
                        ? MediaType.IMAGE_JPEG
                        : MediaType.parseMediaType("image/" + extension);
        return ResponseEntity.ok()
                .contentType(type)
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePublic())
                .body(avatars.read(filename));
    }
}
