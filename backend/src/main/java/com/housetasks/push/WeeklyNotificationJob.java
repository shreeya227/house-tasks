package com.housetasks.push;

import com.housetasks.domain.Entities.Household;
import com.housetasks.domain.Entities.Person;
import com.housetasks.domain.HouseholdRepo;
import com.housetasks.domain.PersonRepo;
import com.housetasks.rotation.RotationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monday morning: tell each person what they have this week.
 * Everyone gets their own line rather than a group blast, which keeps it quiet for
 * housemates who dislike reminders. Opt out with person.notify_weekly = false.
 */
@Component
public class WeeklyNotificationJob {

    private static final Logger log = LoggerFactory.getLogger(WeeklyNotificationJob.class);

    private final HouseholdRepo households;
    private final PersonRepo people;
    private final RotationService rotation;
    private final WebPushSender push;

    public WeeklyNotificationJob(HouseholdRepo households, PersonRepo people,
                                 RotationService rotation, WebPushSender push) {
        this.households = households;
        this.people = people;
        this.rotation = rotation;
        this.push = push;
    }

    @Scheduled(cron = "${housetasks.weekly-cron}", zone = "${housetasks.timezone}")
    public void notifyAllHouseholds() {
        for (Household h : households.findAll()) {
            try {
                notifyHousehold(h);
            } catch (Exception e) {
                log.error("Weekly notification failed for household {}", h.id, e);
            }
        }
    }

    /** Also exposed over the API so you can test without waiting for Monday. */
    public int notifyHousehold(Household h) {
        int weekIndex = rotation.currentWeekIndex(h);
        int sent = 0;
        for (Person p : people.findByHouseholdIdOrderByPosition(h.id)) {
            if (!p.notifyWeekly) continue;
            String body = rotation.notificationFor(h, p, weekIndex);
            if (body == null) continue;
            push.sendToPerson(p.id, "Tasks have rotated", body, "/");
            sent++;
        }
        log.info("Weekly notifications sent for household {} week {}: {}", h.id, weekIndex, sent);
        return sent;
    }
}
