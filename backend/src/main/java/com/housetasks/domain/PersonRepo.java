package com.housetasks.domain;

import com.housetasks.domain.Entities.Person;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PersonRepo extends JpaRepository<Person, Long> {
    List<Person> findByHouseholdIdOrderByPosition(Long householdId);
}
