package com.housetasks.web;

import com.housetasks.config.Tokens;
import com.housetasks.domain.*;
import com.housetasks.domain.Entities.*;
import com.housetasks.push.WebPushSender;
import com.housetasks.push.WeeklyNotificationJob;
import com.housetasks.rotation.Rotation;
import com.housetasks.rotation.RotationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final HouseholdRepo households;
    private final PersonRepo people;
    private final TaskRepo tasks;
    private final SwapRepo swaps;
    private final CompletionRepo completions;
    private final PushSubscriptionRepo subscriptions;
    private final RotationService rotation;
    private final WebPushSender push;
    private final WeeklyNotificationJob weeklyJob;
    private final Tokens tokens;

    public ApiController(HouseholdRepo households, PersonRepo people, TaskRepo tasks,
                         SwapRepo swaps, CompletionRepo completions,
                         PushSubscriptionRepo subscriptions, RotationService rotation,
                         WebPushSender push, WeeklyNotificationJob weeklyJob, Tokens tokens) {
        this.households = households;
        this.people = people;
        this.tasks = tasks;
        this.swaps = swaps;
        this.completions = completions;
        this.subscriptions = subscriptions;
        this.rotation = rotation;
        this.push = push;
        this.weeklyJob = weeklyJob;
        this.tokens = tokens;
    }

    // ---------- joining ----------

    public record PersonSummary(Long id, String name, boolean notifyWeekly) {}
    public record HouseholdSummary(String name, String joinCode, List<PersonSummary> people) {}

    /** Open the join link, see who lives here, and pick your name. */
    @GetMapping("/households/{code}")
    public HouseholdSummary household(@PathVariable String code) {
        Household h = requireHousehold(code);
        List<PersonSummary> ps = people.findByHouseholdIdOrderByPosition(h.id).stream()
                .map(p -> new PersonSummary(p.id, p.name, p.notifyWeekly)).toList();
        return new HouseholdSummary(h.name, h.joinCode, ps);
    }

    public record JoinRequest(Long personId) {}
    public record JoinResponse(Long personId, String name, String token, String vapidPublicKey) {}

    @PostMapping("/households/{code}/join")
    public JoinResponse join(@PathVariable String code, @RequestBody JoinRequest body) {
        Household h = requireHousehold(code);
        Person p = people.findById(body.personId())
                .filter(x -> x.householdId.equals(h.id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person"));
        return new JoinResponse(p.id, p.name, tokens.issue(p.id, h.id), push.publicKey());
    }

    // ---------- the schedule ----------

    @GetMapping("/weeks/current")
    public RotationService.WeekView currentWeek(@RequestHeader("Authorization") String auth) {
        Household h = requireHousehold(auth);
        return rotation.week(h, rotation.currentWeekIndex(h));
    }

    @GetMapping("/weeks/{index}")
    public RotationService.WeekView week(@RequestHeader("Authorization") String auth,
                                         @PathVariable int index) {
        return rotation.week(requireHousehold(auth), index);
    }

    public record RotationTable(int currentWeek, int cycleLength, List<RotationService.WeekView> weeks) {}

    /** The table view. Defaults to the next 8 weeks, but any range works. */
    @GetMapping("/weeks")
    public RotationTable weeks(@RequestHeader("Authorization") String auth,
                               @RequestParam(required = false) Integer from,
                               @RequestParam(defaultValue = "8") int count) {
        Household h = requireHousehold(auth);
        int current = rotation.currentWeekIndex(h);
        int start = from != null ? from : current;
        int cycle = Rotation.cycleLength(
                people.findByHouseholdIdOrderByPosition(h.id),
                tasks.findByHouseholdIdOrderBySequenceOrder(h.id));
        return new RotationTable(current, cycle, rotation.weeks(h, start, start + Math.max(1, count) - 1));
    }

    // ---------- done ticks ----------

    @PostMapping("/weeks/{index}/tasks/{taskId}/done")
    public ResponseEntity<Void> markDone(@RequestHeader("Authorization") String auth,
                                         @PathVariable int index, @PathVariable Long taskId) {
        Tokens.Claims claims = requireClaims(auth);
        Household h = requireHousehold(auth);
        if (completions.findByHouseholdIdAndWeekIndexAndTaskId(h.id, index, taskId).isEmpty()) {
            Completion c = new Completion();
            c.householdId = h.id;
            c.weekIndex = index;
            c.taskId = taskId;
            c.personId = claims.personId();
            completions.save(c);
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/weeks/{index}/tasks/{taskId}/done")
    public ResponseEntity<Void> unmarkDone(@RequestHeader("Authorization") String auth,
                                           @PathVariable int index, @PathVariable Long taskId) {
        Household h = requireHousehold(auth);
        completions.findByHouseholdIdAndWeekIndexAndTaskId(h.id, index, taskId)
                .ifPresent(completions::delete);
        return ResponseEntity.noContent().build();
    }

    // ---------- swaps ----------

    public record SwapRequest(Long personAId, Long personBId) {}

    @PostMapping("/weeks/{index}/swaps")
    public ResponseEntity<Void> swap(@RequestHeader("Authorization") String auth,
                                     @PathVariable int index, @RequestBody SwapRequest body) {
        Household h = requireHousehold(auth);
        if (Objects.equals(body.personAId(), body.personBId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick two different people");
        }
        for (Long id : List.of(body.personAId(), body.personBId())) {
            people.findById(id).filter(p -> p.householdId.equals(h.id))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown person"));
        }
        Swap s = new Swap();
        s.householdId = h.id;
        s.weekIndex = index;
        s.personAId = body.personAId();
        s.personBId = body.personBId();
        swaps.save(s);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/swaps/{id}")
    public ResponseEntity<Void> undoSwap(@RequestHeader("Authorization") String auth,
                                         @PathVariable Long id) {
        Household h = requireHousehold(auth);
        swaps.findById(id).filter(s -> s.householdId.equals(h.id)).ifPresent(swaps::delete);
        return ResponseEntity.noContent().build();
    }

    // ---------- stats ----------

    public record PersonStat(Long personId, String name, int assigned, int done) {}
    public record WeekStat(int weekIndex, String weekStart, int assigned, int done) {}
    public record Stats(int fromWeek, int toWeek, List<PersonStat> people, List<WeekStat> weeks) {}

    /**
     * Completion history for the last N weeks (this week included).
     * A task is credited to whoever was assigned it that week, not to whoever tapped Done,
     * so a swap moves the credit with the work.
     */
    @GetMapping("/stats")
    public Stats stats(@RequestHeader("Authorization") String auth,
                       @RequestParam(defaultValue = "8") int weeks) {
        Household h = requireHousehold(auth);
        int current = rotation.currentWeekIndex(h);
        int span = Math.max(1, Math.min(weeks, 52));
        int from = current - span + 1;

        List<Person> ps = people.findByHouseholdIdOrderByPosition(h.id);
        List<Task> ts = tasks.findByHouseholdIdOrderBySequenceOrder(h.id);

        Map<Long, int[]> perPerson = new LinkedHashMap<>();   // [assigned, done]
        for (Person p : ps) perPerson.put(p.id, new int[2]);
        List<WeekStat> weekStats = new ArrayList<>();

        for (int w = from; w <= current; w++) {
            Map<Long, Long> map = Rotation.assignments(ps, ts, w,
                    swaps.findByHouseholdIdAndWeekIndex(h.id, w));
            Set<Long> doneTasks = new HashSet<>();
            completions.findByHouseholdIdAndWeekIndex(h.id, w).forEach(c -> doneTasks.add(c.taskId));

            int assignedThisWeek = 0, doneThisWeek = 0;
            for (Person p : ps) {
                Long taskId = map.get(p.id);
                if (taskId == null) continue;            // rest week
                assignedThisWeek++;
                perPerson.get(p.id)[0]++;
                if (doneTasks.contains(taskId)) {
                    doneThisWeek++;
                    perPerson.get(p.id)[1]++;
                }
            }
            weekStats.add(new WeekStat(w, rotation.weekStart(h, w).toString(), assignedThisWeek, doneThisWeek));
        }

        List<PersonStat> personStats = new ArrayList<>();
        for (Person p : ps) {
            int[] counts = perPerson.get(p.id);
            personStats.add(new PersonStat(p.id, p.name, counts[0], counts[1]));
        }
        return new Stats(from, current, personStats, weekStats);
    }

    // ---------- push ----------

    public record SubscribeRequest(String endpoint, String p256dh, String auth) {}

    @PostMapping("/push/subscribe")
    public ResponseEntity<Void> subscribe(@RequestHeader("Authorization") String authHeader,
                                          @RequestBody SubscribeRequest body) {
        Tokens.Claims claims = requireClaims(authHeader);
        PushSubscription sub = subscriptions.findByEndpoint(body.endpoint()).orElseGet(PushSubscription::new);
        sub.personId = claims.personId();
        sub.endpoint = body.endpoint();
        sub.p256dhKey = body.p256dh();
        sub.authKey = body.auth();
        subscriptions.save(sub);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/push/subscribe")
    public ResponseEntity<Void> unsubscribe(@RequestHeader("Authorization") String authHeader,
                                            @RequestParam String endpoint) {
        requireClaims(authHeader);
        subscriptions.findByEndpoint(endpoint).ifPresent(subscriptions::delete);
        return ResponseEntity.noContent().build();
    }

    /** Send yourself a test push, so you know it works before Monday. */
    @PostMapping("/push/test")
    public ResponseEntity<Void> testPush(@RequestHeader("Authorization") String authHeader) {
        Tokens.Claims claims = requireClaims(authHeader);
        push.sendToPerson(claims.personId(), "House tasks", "Notifications are working.", "/");
        return ResponseEntity.noContent().build();
    }

    /** Fire the Monday job now, for testing. Remove or protect this before real use. */
    @PostMapping("/push/run-weekly")
    public Map<String, Integer> runWeekly(@RequestHeader("Authorization") String authHeader) {
        Household h = requireHousehold(authHeader);
        return Map.of("sent", weeklyJob.notifyHousehold(h));
    }

    // ---------- helpers ----------

    private Household requireHousehold(String codeOrToken) {
        Tokens.Claims claims = tokens.verify(codeOrToken);
        if (claims != null) {
            return households.findById(claims.householdId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such household"));
        }
        return households.findByJoinCode(codeOrToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again"));
    }

    private Tokens.Claims requireClaims(String auth) {
        Tokens.Claims claims = tokens.verify(auth);
        if (claims == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again");
        return claims;
    }
}
