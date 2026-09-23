package com.housetasks.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

/** All entities in one file to keep the scaffold readable. Split them up as the project grows. */
public class Entities {

    @Entity
    @Table(name = "household")
    public static class Household {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        public String name;
        @Column(name = "join_code", unique = true)
        public String joinCode;
        public String timezone;
        /** The Monday the rotation starts. Week index 0 is that week. */
        @Column(name = "week_start_date")
        public LocalDate weekStartDate;
        @Column(name = "created_at")
        public Instant createdAt = Instant.now();
    }

    @Entity
    @Table(name = "task")
    public static class Task {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        @Column(name = "household_id")
        public Long householdId;
        public String name;
        public String covers = "";
        /** Heavy, Medium or Light. Display only, plus a hint when ordering tasks. */
        @Column(name = "load_level")
        public String loadLevel = "Medium";
        /** Position in the weekly sequence. Everyone walks down this order. */
        @Column(name = "sequence_order")
        public int sequenceOrder;
    }

    @Entity
    @Table(name = "person")
    public static class Person {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        @Column(name = "household_id")
        public Long householdId;
        public String name;
        /** Starting offset in the rotation. */
        public int position;
        /** Set when this person always does the same task and skips the rotation. */
        @Column(name = "owned_task_id")
        public Long ownedTaskId;
        @Column(name = "notify_weekly")
        public boolean notifyWeekly = true;
        /** Admins can add or remove people and tasks. Everyone else is read-only. */
        @Column(name = "is_admin")
        public boolean isAdmin = false;
    }

    @Entity
    @Table(name = "push_subscription")
    public static class PushSubscription {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        @Column(name = "person_id")
        public Long personId;
        @Column(length = 1000, unique = true)
        public String endpoint;
        @Column(name = "p256dh_key")
        public String p256dhKey;
        @Column(name = "auth_key")
        public String authKey;
        @Column(name = "created_at")
        public Instant createdAt = Instant.now();
    }

    @Entity
    @Table(name = "swap")
    public static class Swap {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        @Column(name = "household_id")
        public Long householdId;
        @Column(name = "week_index")
        public int weekIndex;
        @Column(name = "person_a_id")
        public Long personAId;
        @Column(name = "person_b_id")
        public Long personBId;
    }

    @Entity
    @Table(name = "completion")
    public static class Completion {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;
        @Column(name = "household_id")
        public Long householdId;
        @Column(name = "week_index")
        public int weekIndex;
        @Column(name = "task_id")
        public Long taskId;
        @Column(name = "person_id")
        public Long personId;
        @Column(name = "completed_at")
        public Instant completedAt = Instant.now();
    }
}
