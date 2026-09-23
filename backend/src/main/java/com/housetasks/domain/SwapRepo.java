package com.housetasks.domain;

import com.housetasks.domain.Entities.Swap;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SwapRepo extends JpaRepository<Swap, Long> {
    List<Swap> findByHouseholdIdAndWeekIndex(Long householdId, int weekIndex);
    List<Swap> findByHouseholdIdAndWeekIndexBetween(Long householdId, int from, int to);
}
