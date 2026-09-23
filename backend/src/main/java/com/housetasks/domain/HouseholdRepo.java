package com.housetasks.domain;

import com.housetasks.domain.Entities.Household;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface HouseholdRepo extends JpaRepository<Household, Long> {
    Optional<Household> findByJoinCode(String joinCode);
}
