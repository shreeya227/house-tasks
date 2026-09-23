package com.housetasks.push;

import com.housetasks.config.AppConfig;
import com.housetasks.domain.Entities.PushSubscription;
import com.housetasks.domain.PushSubscriptionRepo;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.Security;

/**
 * Sends Web Push messages. The same code reaches iPhones (through Apple's push service),
 * Android and desktop browsers: the browser gives you an endpoint, you post to it.
 */
@Service
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    private final PushSubscriptionRepo subscriptions;
    private final AppConfig.Props props;
    private final PushService client;

    public WebPushSender(PushSubscriptionRepo subscriptions, AppConfig.Props props) {
        this.subscriptions = subscriptions;
        this.props = props;
        this.client = buildClient(props);
    }

    /**
     * Push is optional: without VAPID keys the rest of the app still runs and only
     * notifications are disabled. Crashing the whole service over a missing key makes
     * local development and first deploys needlessly painful.
     */
    private static PushService buildClient(AppConfig.Props props) {
        String publicKey = props.getVapid().getPublicKey();
        String privateKey = props.getVapid().getPrivateKey();
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("VAPID keys are not set, so notifications are disabled. "
                    + "Generate a pair with 'npx web-push generate-vapid-keys' and set "
                    + "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
            return null;
        }
        try {
            return new PushService(publicKey, privateKey, props.getVapid().getSubject());
        } catch (Exception e) {
            log.error("VAPID keys were rejected, so notifications are disabled: {}", e.getMessage());
            return null;
        }
    }

    /** False when the keys are missing or invalid. The UI uses this to hide the enable button. */
    public boolean enabled() {
        return client != null;
    }

    /** Sends to every device this person has registered. Dead subscriptions are pruned. */
    public void sendToPerson(Long personId, String title, String body, String url) {
        if (!enabled()) {
            log.debug("Skipping push to person {}: notifications are disabled", personId);
            return;
        }
        for (PushSubscription sub : subscriptions.findByPersonId(personId)) {
            send(sub, title, body, url);
        }
    }

    private void send(PushSubscription sub, String title, String body, String url) {
        String payload = """
                {"title":%s,"body":%s,"url":%s}
                """.formatted(json(title), json(body), json(url));
        try {
            Notification notification = new Notification(sub.endpoint, sub.p256dhKey, sub.authKey,
                    payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            HttpResponse response = client.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                // The browser threw the subscription away. Stop trying.
                log.info("Pruning expired push subscription {}", sub.id);
                subscriptions.delete(sub);
            } else if (status >= 300) {
                log.warn("Push to subscription {} returned {}", sub.id, status);
            }
        } catch (Exception e) {
            log.warn("Push to subscription {} failed: {}", sub.id, e.getMessage());
        }
    }

    private static String json(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    public String publicKey() {
        return props.getVapid().getPublicKey();
    }
}
