package com.linkit.jobs.service;

import com.linkit.jobs.dto.JobDtos.WriteRequest;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Component
public class JobQualityScorer {
    public static final String VERSION = "job-quality-v1";
    public static final BigDecimal PUBLISH_MINIMUM = new BigDecimal("80.00");

    public record Evaluation(
            BigDecimal score,
            Map<String, Integer> breakdown,
            List<String> recommendations,
            boolean publishable) {}

    public Evaluation evaluate(WriteRequest request, LocalDate today) {
        Map<String, Integer> points = new LinkedHashMap<>();
        List<String> advice = new ArrayList<>();
        text(points, advice, "title", 10, request.title(), 10, "Làm rõ tiêu đề công việc");
        text(
                points,
                advice,
                "description",
                20,
                request.description(),
                100,
                "Mô tả yêu cầu và bối cảnh dự án");
        text(
                points,
                advice,
                "deliverables",
                20,
                request.deliverables(),
                50,
                "Liệt kê sản phẩm cần bàn giao");
        text(
                points,
                advice,
                "acceptanceCriteria",
                20,
                request.acceptanceCriteria(),
                50,
                "Làm rõ tiêu chí nghiệm thu");
        boolean budget =
                request.budgetMin() != null
                        && request.budgetMax() != null
                        && request.budgetMin().signum() >= 0
                        && request.budgetMax().signum() > 0
                        && request.budgetMax().compareTo(request.budgetMin()) >= 0;
        criterion(
                points,
                advice,
                "budget",
                10,
                budget,
                "Đặt ngân sách tối đa lớn hơn 0 và khoảng ngân sách hợp lệ.");
        boolean future = request.deadline() != null && request.deadline().isAfter(today);
        criterion(points, advice, "deadline", 10, future, "Chọn deadline trong tương lai.");
        criterion(
                points,
                advice,
                "skills",
                10,
                !request.skills().isEmpty(),
                "Chọn ít nhất một kỹ năng.");
        BigDecimal score =
                BigDecimal.valueOf(points.values().stream().mapToInt(Integer::intValue).sum())
                        .setScale(2);

        boolean essential =
                !request.title().isBlank()
                        && !request.description().isBlank()
                        && !request.deliverables().isBlank()
                        && !request.acceptanceCriteria().isBlank()
                        && budget
                        && future
                        && !request.skills().isEmpty();
        return new Evaluation(
                score,
                Collections.unmodifiableMap(points),
                List.copyOf(advice),
                score.compareTo(PUBLISH_MINIMUM) >= 0 && essential);
    }

    private void criterion(
            Map<String, Integer> points,
            List<String> advice,
            String key,
            int maximum,
            boolean complete,
            String recommendation) {
        points.put(key, complete ? maximum : 0);
        if (!complete) advice.add(recommendation);
    }

    private void text(
            Map<String, Integer> points,
            List<String> advice,
            String key,
            int maximum,
            String value,
            int fullLength,
            String message) {
        int length = value.codePointCount(0, value.length());
        points.put(key, value.isBlank() ? 0 : length >= fullLength ? maximum : maximum / 2);
        if (length < fullLength)
            advice.add(message + "; từ " + fullLength + " ký tự được điểm đầy đủ.");
    }
}
