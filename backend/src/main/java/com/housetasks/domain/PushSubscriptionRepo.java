package com.housetasks.domain;

import com.housetasks.domain.Entities.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepo extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByPersonId(Long personId);
    Optional<PushSubscription> findByEndpoint(String endpoint);
}
