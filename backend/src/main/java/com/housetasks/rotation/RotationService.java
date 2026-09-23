package com.housetasks.rotation;

import com.housetasks.domain.*;
import com.housetasks.domain.Entities.*;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** Thin wrapper that feeds the database into {@link Rotation} and shapes API responses. */
@Service
public class RotationService {

    private final PersonRepo people;
    private final TaskRepo tasks;
    private final SwapRepo swaps;
    private final CompletionRepo completions;
    private final Clock clock;

    public RotationService(PersonRepo people, TaskRepo tasks, SwapRepo swaps,
                           CompletionRepo completions, Clock clock) {
        this.people = people;
        this.tasks = tasks;
        this.swaps = swaps;
        this.completions = completions;
        this.clock = clock;
    }

    public record TaskLine(Long taskId, String taskName, String covers, String loadLevel,
                           List<String> people, List<Long> peopleIds, boolean done) {}

    public record WeekView(int weekIndex, LocalDate weekStart, List<TaskLine> tasks,
                           List<String> resting, List<String> unassigned) {}

    public int currentWeekIndex(Household h) {
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(h.timezone)));
        return Rotation.weekIndex(h.weekStartDate, today);
    }

    public LocalDate weekStart(Household h, int weekIndex) {
        return Rotation.mondayOf(h.weekStartDate).plusWeeks(weekIndex);
    }

    public WeekView week(Household h, int weekIndex) {
        List<Person> ps = people.findByHouseholdIdOrderByPosition(h.id);
        List<Task> ts = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        Map<Long, Long> map = Rotation.assignments(ps, ts, weekIndex,
                swaps.findByHouseholdIdAndWeekIndex(h.id, weekIndex));

        Set<Long> doneTaskIds = new HashSet<>();
        for (Completion c : completions.findByHouseholdIdAndWeekIndex(h.id, weekIndex)) {
            doneTaskIds.add(c.taskId);
        }

        List<TaskLine> lines = new ArrayList<>();
        for (Task t : ts) {
            List<String> names = new ArrayList<>();
            List<Long> ids = new ArrayList<>();
            for (Person p : ps) {
                if (Objects.equals(map.get(p.id), t.id)) { names.add(p.name); ids.add(p.id); }
            }
            lines.add(new TaskLine(t.id, t.name, t.covers, t.loadLevel, names, ids,
                    doneTaskIds.contains(t.id)));
        }

        List<String> resting = new ArrayList<>();
        for (Person p : ps) if (map.containsKey(p.id) && map.get(p.id) == null) resting.add(p.name);

        List<String> unassigned = new ArrayList<>();
        for (Long id : Rotation.unassignedTasks(ts, map)) {
            ts.stream().filter(t -> t.id.equals(id)).findFirst().ifPresent(t -> unassigned.add(t.name));
        }

        return new WeekView(weekIndex, weekStart(h, weekIndex), lines, resting, unassigned);
    }

    public List<WeekView> weeks(Household h, int from, int to) {
        List<WeekView> out = new ArrayList<>();
        for (int w = from; w <= to; w++) out.add(week(h, w));
        return out;
    }

    /** What to tell one person in a push notification, or null when they should get nothing. */
    public String notificationFor(Household h, Person p, int weekIndex) {
        List<Person> ps = people.findByHouseholdIdOrderByPosition(h.id);
        List<Task> ts = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        Map<Long, Long> map = Rotation.assignments(ps, ts, weekIndex,
                swaps.findByHouseholdIdAndWeekIndex(h.id, weekIndex));
        if (!map.containsKey(p.id)) return null;
        Long taskId = map.get(p.id);
        if (taskId == null) return "You are off this week. Enjoy it.";
        return ts.stream().filter(t -> t.id.equals(taskId)).findFirst()
                .map(t -> "Your task this week: " + t.name + ". Any time before Sunday 9pm.")
                .orElse(null);
    }
}
