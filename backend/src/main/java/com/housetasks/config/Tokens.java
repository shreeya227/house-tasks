package com.housetasks.config;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Deliberately minimal auth for a 7-person house: a signed "personId.householdId" token,
 * stored in the browser after someone picks their name. No passwords, no email, nothing to
 * forget. Swap this for real accounts only if the app ever leaves the house.
 */
@Component
public class Tokens {

    private final String secret;

    public Tokens(AppConfig.Props props) {
        this.secret = props.getTokenSecret();
    }

    public String issue(Long personId, Long householdId) {
        String body = personId + "." + householdId;
        return body + "." + sign(body);
    }

    public record Claims(Long personId, Long householdId) {}

    /** @return the claims, or null when the token is missing, malformed or unsigned. */
    public Claims verify(String token) {
        if (token == null) return null;
        String value = token.startsWith("Bearer ") ? token.substring(7) : token;
        String[] parts = value.split("\\.");
        if (parts.length != 3) return null;
        String body = parts[0] + "." + parts[1];
        if (!constantTimeEquals(sign(body), parts[2])) return null;
        try {
            return new Claims(Long.parseLong(parts[0]), Long.parseLong(parts[1]));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String sign(String body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot sign token", e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }
}
