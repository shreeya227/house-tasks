package com.housetasks.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties(AppConfig.Props.class)
public class AppConfig implements WebMvcConfigurer {

    /** Injected everywhere instead of LocalDate.now() so tests can freeze time. */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:*", "https://*.vercel.app", "https://*.onrender.com")
                .allowedMethods("GET", "POST", "DELETE");
    }

    @ConfigurationProperties(prefix = "housetasks")
    public static class Props {
        private Vapid vapid = new Vapid();
        private String tokenSecret = "change-me";
        private String weeklyCron = "0 0 8 * * MON";
        private String timezone = "America/New_York";

        public Vapid getVapid() { return vapid; }
        public void setVapid(Vapid vapid) { this.vapid = vapid; }
        public String getTokenSecret() { return tokenSecret; }
        public void setTokenSecret(String s) { this.tokenSecret = s; }
        public String getWeeklyCron() { return weeklyCron; }
        public void setWeeklyCron(String s) { this.weeklyCron = s; }
        public String getTimezone() { return timezone; }
        public void setTimezone(String s) { this.timezone = s; }

        public static class Vapid {
            private String publicKey = "";
            private String privateKey = "";
            private String subject = "mailto:you@example.com";
            public String getPublicKey() { return publicKey; }
            public void setPublicKey(String s) { this.publicKey = s; }
            public String getPrivateKey() { return privateKey; }
            public void setPrivateKey(String s) { this.privateKey = s; }
            public String getSubject() { return subject; }
            public void setSubject(String s) { this.subject = s; }
        }
    }
}
