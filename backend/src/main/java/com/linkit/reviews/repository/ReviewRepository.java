package com.linkit.reviews.repository;

import com.linkit.reviews.entity.Review;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    interface FreelancerRating {
        Long getFreelancerId();

        Double getAverageRating();

        Long getReviewCount();
    }

    @org.springframework.data.jpa.repository.Query(
            "select r.freelancer.userId as freelancerId, avg(r.overallRating) as averageRating, count(r.id) as reviewCount from Review r where r.freelancer.userId in :ids group by r.freelancer.userId")
    java.util.List<FreelancerRating> ratingsForFreelancers(
            @org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    @org.springframework.data.jpa.repository.EntityGraph(
            attributePaths = {
                "reviewer",
                "finalAcceptance",
                "finalAcceptance.assignment",
                "finalAcceptance.assignment.job",
                "finalAcceptance.assignment.client"
            })
    java.util.List<Review> findByFreelancer_UserIdOrderByCreatedAtDescIdDesc(Long freelancerId);

    java.util.Optional<Review> findByFinalAcceptance_AssignmentId(Long assignmentId);

    boolean existsByFinalAcceptance_AssignmentId(Long assignmentId);
}
