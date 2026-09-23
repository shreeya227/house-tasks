package com.housetasks.config;

import com.housetasks.domain.*;
import com.housetasks.domain.Entities.*;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

/**
 * Seeds one household the first time the app starts, using the real plan:
 * heavy and light tasks alternate and the two bathrooms sit two weeks apart,
 * so nobody gets two hard weeks in a row.
 * Delete this class once your own data is in the database.
 */
@Configuration
public class DemoData {

    @Bean
    ApplicationRunner seed(HouseholdRepo households, PersonRepo people, TaskRepo tasks) {
        return args -> {
            if (households.count() > 0) return;

            Household h = new Household();
            h.name = "Our house";
            h.joinCode = "burlington7";
            h.timezone = "America/New_York";
            h.weekStartDate = LocalDate.now().with(DayOfWeek.MONDAY);
            households.save(h);

            record Seed(String name, String covers, String load) {}
            List<Seed> seeds = List.of(
                new Seed("Kitchen", "Counters, stovetop, sink, microwave, floor, fridge wipe-out", "Heavy"),
                new Seed("Trash & recycling", "Empty bins every 3 to 4 days, bins on the road Wednesday night", "Light"),
                new Seed("Upstairs bathroom", "Toilet, sink, shower, mirror, floor", "Medium"),
                new Seed("Living + dining", "Vacuum or mop, wipe surfaces, dining table", "Medium"),
                new Seed("Basement bathroom", "Toilet, sink, shower, mirror, floor", "Medium"),
                new Seed("Basement common + stairs", "Vacuum or mop the common space and stairs", "Medium")
            );
            for (int i = 0; i < seeds.size(); i++) {
                Task t = new Task();
                t.householdId = h.id;
                t.name = seeds.get(i).name();
                t.covers = seeds.get(i).covers();
                t.loadLevel = seeds.get(i).load();
                t.sequenceOrder = i;
                tasks.save(t);
            }

            List<String> names = List.of("Amanda", "Shreeya", "Shikshya", "Yogesh", "Jhapali", "Nikit", "Adit");
            for (int i = 0; i < names.size(); i++) {
                Person p = new Person();
                p.householdId = h.id;
                p.name = names.get(i);
                p.position = i;
                p.isAdmin = p.name.equals("Shreeya");   // the one who sets the house up
                people.save(p);
            }
        };
    }
}
