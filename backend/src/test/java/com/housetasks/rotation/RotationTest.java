package com.housetasks.rotation;

import com.housetasks.domain.Entities.Person;
import com.housetasks.domain.Entities.Swap;
import com.housetasks.domain.Entities.Task;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** The rotation is the heart of the app, so it is tested without a database or a clock. */
class RotationTest {

    private Person person(long id, int position, Long owned) {
        Person p = new Person();
        p.id = id;
        p.position = position;
        p.ownedTaskId = owned;
        return p;
    }

    private Task task(long id, int order) {
        Task t = new Task();
        t.id = id;
        t.sequenceOrder = order;
        return t;
    }

    private List<Person> sevenPeople() {
        List<Person> ps = new ArrayList<>();
        for (int i = 0; i < 7; i++) ps.add(person(i + 1, i, null));
        return ps;
    }

    private List<Task> sixTasks() {
        List<Task> ts = new ArrayList<>();
        for (int i = 0; i < 6; i++) ts.add(task(100 + i, i));
        return ts;
    }

    @Test
    void firstWeekGivesEveryoneTheirStartingTask() {
        Map<Long, Long> a = Rotation.assignments(sevenPeople(), sixTasks(), 0, List.of());
        assertEquals(100L, a.get(1L));
        assertEquals(105L, a.get(6L));
        assertNull(a.get(7L), "the seventh person rests in week 0");
    }

    @Test
    void everyoneShiftsOneTaskEachWeek() {
        Map<Long, Long> a = Rotation.assignments(sevenPeople(), sixTasks(), 1, List.of());
        assertEquals(101L, a.get(1L), "person 1 moves to the next task");
        assertNull(a.get(6L), "the rest week moves along too");
        assertEquals(100L, a.get(7L));
    }

    @Test
    void rotationRepeatsAfterOneCycle() {
        Map<Long, Long> week0 = Rotation.assignments(sevenPeople(), sixTasks(), 0, List.of());
        Map<Long, Long> week7 = Rotation.assignments(sevenPeople(), sixTasks(), 7, List.of());
        assertEquals(week0, week7);
        assertEquals(7, Rotation.cycleLength(sevenPeople(), sixTasks()));
    }

    @Test
    void everyonePassesThroughEveryTaskAndOneRestWeek() {
        for (Person p : sevenPeople()) {
            Set<Long> seen = new HashSet<>();
            for (int w = 0; w < 7; w++) {
                seen.add(Rotation.assignments(sevenPeople(), sixTasks(), w, List.of()).get(p.id));
            }
            assertEquals(7, seen.size(), "person " + p.id + " should see 6 tasks plus a rest week");
            assertTrue(seen.contains(null));
        }
    }

    @Test
    void ownedTaskStaysWithItsOwnerEveryWeek() {
        List<Person> ps = sevenPeople();
        ps.get(3).ownedTaskId = 102L;   // this person always does task 102
        for (int w = 0; w < 14; w++) {
            Map<Long, Long> a = Rotation.assignments(ps, sixTasks(), w, List.of());
            assertEquals(102L, a.get(4L));
            assertEquals(1, a.values().stream().filter(v -> Objects.equals(v, 102L)).count());
        }
    }

    @Test
    void swapExchangesTwoPeopleForThatWeekOnly() {
        Swap s = new Swap();
        s.weekIndex = 2;
        s.personAId = 1L;
        s.personBId = 7L;

        Map<Long, Long> before = Rotation.assignments(sevenPeople(), sixTasks(), 2, List.of());
        Map<Long, Long> after = Rotation.assignments(sevenPeople(), sixTasks(), 2, List.of(s));
        assertEquals(before.get(7L), after.get(1L));
        assertEquals(before.get(1L), after.get(7L));

        Map<Long, Long> nextWeek = Rotation.assignments(sevenPeople(), sixTasks(), 3, List.of(s));
        assertEquals(Rotation.assignments(sevenPeople(), sixTasks(), 3, List.of()), nextWeek,
                "a swap never leaks into another week");
    }

    @Test
    void fewerPeopleThanTasksLeavesTasksUnassigned() {
        List<Person> three = List.of(person(1, 0, null), person(2, 1, null), person(3, 2, null));
        Map<Long, Long> a = Rotation.assignments(three, sixTasks(), 0, List.of());
        assertEquals(3, Rotation.unassignedTasks(sixTasks(), a).size());
    }

    @Test
    void weekIndexCountsMondaysFromTheStart() {
        LocalDate start = LocalDate.of(2026, 9, 21);          // a Monday
        assertEquals(0, Rotation.weekIndex(start, start));
        assertEquals(0, Rotation.weekIndex(start, LocalDate.of(2026, 9, 27))); // that Sunday
        assertEquals(1, Rotation.weekIndex(start, LocalDate.of(2026, 9, 28)));
        assertEquals(7, Rotation.weekIndex(start, LocalDate.of(2026, 11, 9)));
        assertEquals(-1, Rotation.weekIndex(start, LocalDate.of(2026, 9, 14)));
    }
}
