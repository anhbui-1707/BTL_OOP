package com.linkit.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.DriverManager;

@EnabledIfEnvironmentVariable(named = "LINKIT_MIGRATION_TEST", matches = "true")
class FlywayMigrationIntegrationTest {
    @Test
    void migratesValidatesAndRepeatsWithoutChanges() throws Exception {
        String url =
                "jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;"
                        + "integratedSecurity=true;encrypt=true;trustServerCertificate=true";
        Flyway flyway =
                Flyway.configure()
                        .dataSource(url, null, null)
                        .locations("classpath:db/migration")
                        .defaultSchema("dbo")
                        .createSchemas(false)
                        .baselineOnMigrate(false)
                        .cleanDisabled(true)
                        .load();
        flyway.migrate();
        flyway.validate();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).hasSize(6);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        try (var connection = DriverManager.getConnection(url);
                var statement = connection.createStatement();
                var result =
                        statement.executeQuery(
                                "SELECT COUNT(*) FROM sys.tables "
                                        + "WHERE schema_id = SCHEMA_ID('dbo') AND name <> 'flyway_schema_history'")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).isEqualTo(23);
        }
    }
}
