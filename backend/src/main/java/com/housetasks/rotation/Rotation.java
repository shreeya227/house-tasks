package com.housetasks.rotation;

import com.housetasks.domain.Entities.Person;
import com.housetasks.domain.Entities.Swap;
import com.housetasks.domain.Entities.Task;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * The core of the whole app, deliberately pure: no database, no Spring, no clock.
 * Assignments are never stored. They are computed from the week index, each person's
 * position, and the task sequence, so adding or removing a person never needs a backfill.
 *
 * The rule: slot = (position + weekIndex) mod slotCount, walking down the task sequence.
 * When there are more people than tasks, the extra slots are rest weeks.
 */
public final class Rotation {

    /** A task id, or null for a rest week. */
    public record Assignment(Long personId, Long taskId) {
        public boolean isRest() { return taskId == null; }
    }

    private Rotation() {}

    /** Monday of the week containing the given date. */
    public static LocalDate mondayOf(LocalDate date) {
        return date.with(DayOfWeek.MONDAY);
    }

    /** Week index of a date relative to the rotation start. Negative before the start. */
    public static int weekIndex(LocalDate startMonday, LocalDate date) {
        long days = ChronoUnit.DAYS.between(mondayOf(startMonday), mondayOf(date));
        return (int) Math.floorDiv(days, 7L);
    }

    /**
     * Who does what in a given week.
     *
     * @param people ordered by position
     * @param tasks  ordered by sequenceOrder
     * @param swaps  swaps that apply to this week only
     */
    public static Map<Long, Long> assignments(List<Person> people, List<Task> tasks,
                                              int weekIndex, List<Swap> swaps) {
        Map<Long, Long> result = new LinkedHashMap<>();
        Set<Long> taskIds = new LinkedHashSet<>();
        for (Task t : tasks) taskIds.add(t.id);

        // 1. People who always do the same task keep it and leave the rotation.
        Set<Long> owned = new LinkedHashSet<>();
        for (Person p : people) {
            if (p.ownedTaskId != null && taskIds.contains(p.ownedTaskId) && !owned.contains(p.ownedTaskId)) {
                result.put(p.id, p.ownedTaskId);
                owned.add(p.ownedTaskId);
            }
        }

        // 2. Everyone else rotates through the remaining tasks, in sequence order.
        List<Person> rotating = new ArrayList<>();
        for (Person p : people) if (!result.containsKey(p.id)) rotating.add(p);

        List<Long> slots = new ArrayList<>();
        for (Task t : tasks) if (!owned.contains(t.id)) slots.add(t.id);

        int slotCount = Math.max(rotating.size(), slots.size());
        if (slotCount > 0) {
            while (slots.size() < slotCount) slots.add(null); // rest weeks
            int shift = Math.floorMod(weekIndex, slotCount);
            for (int i = 0; i < rotating.size(); i++) {
                Long slot = slots.get((i + shift) % slotCount);
                result.put(rotating.get(i).id, slot);
            }
        }

        // 3. A swap exchanges two people's whole assignment for this week, rest weeks included.
        for (Swap s : swaps) {
            if (s.weekIndex != weekIndex) continue;
            if (!result.containsKey(s.personAId) || !result.containsKey(s.personBId)) continue;
            Long a = result.get(s.personAId);
            result.put(s.personAId, result.get(s.personBId));
            result.put(s.personBId, a);
        }
        return result;
    }

    /** Tasks nobody is doing this week: usually a sign the house has fewer people than tasks. */
    public static List<Long> unassignedTasks(List<Task> tasks, Map<Long, Long> assignments) {
        Set<Long> taken = new HashSet<>(assignments.values());
        List<Long> out = new ArrayList<>();
        for (Task t : tasks) if (!taken.contains(t.id)) out.add(t.id);
        return out;
    }

    /** How many weeks before the rotation repeats. Useful for repeating calendar reminders. */
    public static int cycleLength(List<Person> people, List<Task> tasks) {
        Set<Long> owned = new HashSet<>();
        for (Person p : people) if (p.ownedTaskId != null) owned.add(p.ownedTaskId);
        long rotatingPeople = people.stream().filter(p -> p.ownedTaskId == null).count();
        long rotatingTasks = tasks.stream().filter(t -> !owned.contains(t.id)).count();
        return (int) Math.max(rotatingPeople, rotatingTasks);
    }
}
