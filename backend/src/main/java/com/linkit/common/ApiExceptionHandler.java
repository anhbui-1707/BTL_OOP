package com.linkit.common;

import jakarta.validation.ConstraintViolationException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.LinkedHashMap;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException error) {
        return response(ApiError.of(error.status().value(), error.code(), error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        var fields = new LinkedHashMap<String, String>();
        error.getBindingResult()
                .getFieldErrors()
                .forEach(field -> fields.putIfAbsent(field.getField(), field.getDefaultMessage()));
        return response(
                new ApiError(
                        Instant.now(), 422, "VALIDATION_FAILED", "Dữ liệu không hợp lệ.", fields));
    }

    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class})
    ResponseEntity<ApiError> validation() {
        return response(ApiError.of(422, "VALIDATION_FAILED", "Dữ liệu không hợp lệ."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed() {
        return response(
                ApiError.of(400, "INVALID_REQUEST", "JSON hoặc kiểu dữ liệu không hợp lệ."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> oversizedAvatar(MaxUploadSizeExceededException error) {
        return response(ApiError.of(422, "INVALID_AVATAR", "Ảnh vượt giới hạn 2 MB."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> invalidParameter() {
        return response(ApiError.of(400, "INVALID_REQUEST", "Tham số không hợp lệ."));
    }

    @ExceptionHandler({
        OptimisticLockingFailureException.class,
        PessimisticLockingFailureException.class
    })
    ResponseEntity<ApiError> concurrentChange() {
        return response(
                ApiError.of(
                        409,
                        "CONCURRENT_CHANGE",
                        "Dữ liệu đã thay đổi hoặc đang được cập nhật; hãy tải lại."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> conflict() {
        return response(
                ApiError.of(
                        409,
                        "CONFLICT",
                        "Dữ liệu đã tồn tại hoặc xung đột với trạng thái hiện tại."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> forbidden() {
        return response(
                ApiError.of(403, "FORBIDDEN", "Bạn không có quyền truy cập tài nguyên này."));
    }

    private ResponseEntity<ApiError> response(ApiError error) {
        return ResponseEntity.status(error.status())
                .cacheControl(CacheControl.noStore())
                .body(error);
    }
}
