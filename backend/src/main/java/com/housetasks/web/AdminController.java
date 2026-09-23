package com.housetasks.web;

import com.housetasks.config.Tokens;
import com.housetasks.domain.*;
import com.housetasks.domain.Entities.*;
import com.housetasks.rotation.Rotation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Household admin: add and remove people, edit and reorder tasks.
 * Every endpoint requires an admin token, so a housemate opening the link can only
 * ever read the schedule and tick tasks done.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final HouseholdRepo households;
    private final PersonRepo people;
    private final TaskRepo tasks;
    private final Tokens tokens;

    public AdminController(HouseholdRepo households, PersonRepo people, TaskRepo tasks, Tokens tokens) {
        this.households = households;
        this.people = people;
        this.tasks = tasks;
        this.tokens = tokens;
    }

    // ---------- people ----------

    public record PersonBody(String name, Long ownedTaskId, Boolean notifyWeekly, Boolean isAdmin) {}

    @PostMapping("/people")
    public Person addPerson(@RequestHeader("Authorization") String auth, @RequestBody PersonBody body) {
        Household h = requireAdmin(auth);
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A name is required");
        }
        List<Person> existing = people.findByHouseholdIdOrderByPosition(h.id);
        Person p = new Person();
        p.householdId = h.id;
        p.name = body.name().trim();
        p.position = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).position + 1;
        if (body.notifyWeekly() != null) p.notifyWeekly = body.notifyWeekly();
        if (body.ownedTaskId() != null) p.ownedTaskId = body.ownedTaskId();
        return people.save(p);
    }

    @PostMapping("/people/{id}")
    public Person updatePerson(@RequestHeader("Authorization") String auth,
                               @PathVariable Long id, @RequestBody PersonBody body) {
        Household h = requireAdmin(auth);
        Person p = requirePerson(h, id);
        if (body.name() != null && !body.name().isBlank()) p.name = body.name().trim();
        if (body.notifyWeekly() != null) p.notifyWeekly = body.notifyWeekly();
        if (body.isAdmin() != null) p.isAdmin = body.isAdmin();
        // ownedTaskId is nullable on purpose: sending null clears it, so a person
        // who owned a task can go back into the rotation.
        p.ownedTaskId = body.ownedTaskId();
        return people.save(p);
    }

    @DeleteMapping("/people/{id}")
    @Transactional
    public ResponseEntity<Void> removePerson(@RequestHeader("Authorization") String auth,
                                             @PathVariable Long id) {
        Household h = requireAdmin(auth);
        Person p = requirePerson(h, id);
        people.delete(p);
        renumberPeople(h);
        return ResponseEntity.noContent().build();
    }

    /** Move a person up or down the rotation order: delta is -1 or 1. */
    @PostMapping("/people/{id}/move")
    @Transactional
    public List<Person> movePerson(@RequestHeader("Authorization") String auth,
                                   @PathVariable Long id, @RequestParam int delta) {
        Household h = requireAdmin(auth);
        List<Person> list = people.findByHouseholdIdOrderByPosition(h.id);
        int index = indexOf(list, id);
        int target = index + Integer.signum(delta);
        if (target >= 0 && target < list.size()) {
            Person a = list.get(index), b = list.get(target);
            int tmp = a.position;
            a.position = b.position;
            b.position = tmp;
            people.saveAll(List.of(a, b));
        }
        return people.findByHouseholdIdOrderByPosition(h.id);
    }

    // ---------- tasks ----------

    public record TaskBody(String name, String covers, String loadLevel) {}

    @PostMapping("/tasks")
    public Task addTask(@RequestHeader("Authorization") String auth, @RequestBody TaskBody body) {
        Household h = requireAdmin(auth);
        List<Task> existing = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        Task t = new Task();
        t.householdId = h.id;
        t.name = body.name() == null || body.name().isBlank() ? "New task" : body.name().trim();
        t.covers = body.covers() == null ? "" : body.covers().trim();
        t.loadLevel = body.loadLevel() == null ? "Medium" : body.loadLevel();
        t.sequenceOrder = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).sequenceOrder + 1;
        return tasks.save(t);
    }

    @PostMapping("/tasks/{id}")
    public Task updateTask(@RequestHeader("Authorization") String auth,
                           @PathVariable Long id, @RequestBody TaskBody body) {
        Household h = requireAdmin(auth);
        Task t = requireTask(h, id);
        if (body.name() != null && !body.name().isBlank()) t.name = body.name().trim();
        if (body.covers() != null) t.covers = body.covers().trim();
        if (body.loadLevel() != null) t.loadLevel = body.loadLevel();
        return tasks.save(t);
    }

    @DeleteMapping("/tasks/{id}")
    @Transactional
    public ResponseEntity<Void> removeTask(@RequestHeader("Authorization") String auth,
                                           @PathVariable Long id) {
        Household h = requireAdmin(auth);
        Task t = requireTask(h, id);
        // Anyone who owned this task goes back into the rotation.
        for (Person p : people.findByHouseholdIdOrderByPosition(h.id)) {
            if (id.equals(p.ownedTaskId)) {
                p.ownedTaskId = null;
                people.save(p);
            }
        }
        tasks.delete(t);
        renumberTasks(h);
        return ResponseEntity.noContent().build();
    }

    /**
     * Reorder the weekly sequence: delta is -1 (earlier) or 1 (later).
     * Worth keeping heavy work next to light work, and the two bathrooms apart,
     * so nobody gets two hard weeks in a row.
     */
    @PostMapping("/tasks/{id}/move")
    @Transactional
    public List<Task> moveTask(@RequestHeader("Authorization") String auth,
                               @PathVariable Long id, @RequestParam int delta) {
        Household h = requireAdmin(auth);
        List<Task> list = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        int index = indexOfTask(list, id);
        int target = index + Integer.signum(delta);
        if (target >= 0 && target < list.size()) {
            Task a = list.get(index), b = list.get(target);
            int tmp = a.sequenceOrder;
            a.sequenceOrder = b.sequenceOrder;
            b.sequenceOrder = tmp;
            tasks.saveAll(List.of(a, b));
        }
        return tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
    }

    // ---------- household ----------

    public record HouseholdBody(String name, String timezone, String weekStartDate) {}

    @PostMapping("/household")
    public Household updateHousehold(@RequestHeader("Authorization") String auth,
                                     @RequestBody HouseholdBody body) {
        Household h = requireAdmin(auth);
        if (body.name() != null && !body.name().isBlank()) h.name = body.name().trim();
        if (body.timezone() != null && !body.timezone().isBlank()) h.timezone = body.timezone().trim();
        if (body.weekStartDate() != null && !body.weekStartDate().isBlank()) {
            // Always snapped to a Monday so week indexing stays predictable.
            h.weekStartDate = Rotation.mondayOf(java.time.LocalDate.parse(body.weekStartDate()));
        }
        return households.save(h);
    }

    /** Everything the admin screen needs in one call. */
    @GetMapping("/setup")
    public Map<String, Object> setup(@RequestHeader("Authorization") String auth) {
        Household h = requireAdmin(auth);
        List<Person> ps = people.findByHouseholdIdOrderByPosition(h.id);
        List<Task> ts = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        return Map.of(
                "household", h,
                "people", ps,
                "tasks", ts,
                "cycleLength", Rotation.cycleLength(ps, ts),
                "restSlots", Math.max(0, ps.stream().filter(p -> p.ownedTaskId == null).count()
                        - ts.stream().filter(t -> ps.stream().noneMatch(p -> t.id.equals(p.ownedTaskId))).count()));
    }

    /** Am I an admin? Used to decide whether to show the Setup tab at all. */
    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader("Authorization") String auth) {
        Tokens.Claims claims = tokens.verify(auth);
        if (claims == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again");
        boolean admin = people.findById(claims.personId()).map(p -> p.isAdmin).orElse(false);
        return Map.of("isAdmin", admin);
    }

    // ---------- helpers ----------

    private Household requireAdmin(String auth) {
        Tokens.Claims claims = tokens.verify(auth);
        if (claims == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again");
        Person me = people.findById(claims.personId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again"));
        if (!me.isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the house admin can change this");
        }
        return households.findById(claims.householdId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such household"));
    }

    private Person requirePerson(Household h, Long id) {
        return people.findById(id).filter(p -> p.householdId.equals(h.id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person"));
    }

    private Task requireTask(Household h, Long id) {
        return tasks.findById(id).filter(t -> t.householdId.equals(h.id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such task"));
    }

    private int indexOf(List<Person> list, Long id) {
        for (int i = 0; i < list.size(); i++) if (list.get(i).id.equals(id)) return i;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person");
    }

    private int indexOfTask(List<Task> list, Long id) {
        for (int i = 0; i < list.size(); i++) if (list.get(i).id.equals(id)) return i;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such task");
    }

    /** Keeps positions contiguous after a delete, so the rotation has no gaps. */
    private void renumberPeople(Household h) {
        List<Person> list = people.findByHouseholdIdOrderByPosition(h.id);
        for (int i = 0; i < list.size(); i++) list.get(i).position = i;
        people.saveAll(list);
    }

    private void renumberTasks(Household h) {
        List<Task> list = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);
        for (int i = 0; i < list.size(); i++) list.get(i).sequenceOrder = i;
        tasks.saveAll(list);
    }
}
