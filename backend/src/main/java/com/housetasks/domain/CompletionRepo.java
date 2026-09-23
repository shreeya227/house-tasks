package com.housetasks.domain;

import com.housetasks.domain.Entities.Completion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CompletionRepo extends JpaRepository<Completion, Long> {
    List<Completion> findByHouseholdIdAndWeekIndex(Long householdId, int weekIndex);
    Optional<Completion> findByHouseholdIdAndWeekIndexAndTaskId(Long householdId, int weekIndex, Long taskId);
}
