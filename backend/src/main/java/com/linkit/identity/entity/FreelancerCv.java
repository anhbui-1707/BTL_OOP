package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.*;

@Entity
@Table(name = "freelancer_cvs", schema = "dbo")
public class FreelancerCv {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Column(name = "freelancer_id", nullable = false, columnDefinition = "bigint")
    private Long freelancerId;

    @Nationalized
    @Column(name = "file_name", nullable = false, columnDefinition = "nvarchar(255)", length = 255)
    private String fileName;

    @Column(name = "byte_size", nullable = false, columnDefinition = "int")
    private Integer byteSize;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "content", nullable = false, columnDefinition = "varbinary(max)")
    private byte[] content;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "uploaded_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant uploadedAt;

    public FreelancerCv() {}

    public Long getId() {
        return id;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public void setFreelancerId(Long value) {
        freelancerId = value;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String value) {
        fileName = value;
    }

    public Integer getByteSize() {
        return byteSize;
    }

    public void setByteSize(Integer value) {
        byteSize = value;
    }

    public byte[] getContent() {
        return content;
    }

    public void setContent(byte[] value) {
        content = value;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(Instant value) {
        uploadedAt = value;
    }
}
