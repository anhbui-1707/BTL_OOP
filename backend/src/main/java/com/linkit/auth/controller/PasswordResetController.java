package com.linkit.auth.controller;

import com.linkit.auth.service.PasswordResetService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/password")
public class PasswordResetController {
    private final PasswordResetService reset;

    public PasswordResetController(PasswordResetService reset) {
        this.reset = reset;
    }

    public record RequestCode(@NotBlank @Email @Size(max = 254) String email) {}

    public record Confirm(
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "[0-9]{6}") String code,
            @NotBlank @Size(min = 12, max = 72) String newPassword) {}

    public record Message(String message) {}

    @PostMapping("/request")
    public ResponseEntity<Message> request(@Valid @RequestBody RequestCode input) {
        reset.request(input.email());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new Message("Nếu email đã đăng ký, mã xác minh sẽ được gửi đến hộp thư."));
    }

    @PostMapping("/confirm")
    public ResponseEntity<Message> confirm(@Valid @RequestBody Confirm input) {
        reset.confirm(input.email(), input.code(), input.newPassword());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new Message("Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại."));
    }
}
