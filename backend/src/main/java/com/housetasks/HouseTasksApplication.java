package com.housetasks;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HouseTasksApplication {
    public static void main(String[] args) {
        SpringApplication.run(HouseTasksApplication.class, args);
    }
}
