package com.housetasks.domain;

import com.housetasks.domain.Entities.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepo extends JpaRepository<Task, Long> {
    List<Task> findByHouseholdIdOrderBySequenceOrder(Long householdId);
}
