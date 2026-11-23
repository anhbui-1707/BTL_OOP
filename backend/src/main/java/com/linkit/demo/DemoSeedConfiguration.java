package com.linkit.demo;

import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration(proxyBeanMethods = false)
@Profile("(dev | demo) & !prod & !production")
@ConditionalOnProperty(name = "linkit.seed.enabled", havingValue = "true")
public class DemoSeedConfiguration {
    @Bean
    DemoSeeder demoSeeder(
            JdbcTemplate jdbc,
            PlatformTransactionManager transactions,
            PasswordEncoder encoder,
            Environment environment) {
        return new DemoSeeder(jdbc, transactions, encoder, environment);
    }

    @Bean
    ApplicationRunner demoSeedRunner(DemoSeeder seeder) {
        return args -> {
            DemoSeeder.Result result = seeder.seed();
            LoggerFactory.getLogger(DemoSeedConfiguration.class)
                    .info(
                            "LinkIT demo seed: {}, {} scenario records across {} tables (plus seed marker/receipt); counts={}",
                            result.created()
                                    ? "created"
                                    : "skipped existing; user changes preserved",
                            result.total(),
                            result.counts().size(),
                            result.counts());
        };
    }
}
