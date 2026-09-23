# Stage 1: build the React frontend.
# Run from the REPO ROOT as build context, so set Render's Dockerfile Path to
# backend/Dockerfile and leave Root Directory empty.
FROM node:20 AS frontend
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: build the Spring Boot jar, with the frontend bundled into it.
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /app
COPY backend/pom.xml .
RUN mvn -B dependency:go-offline
COPY backend/src ./src
# Anything in resources/static is served at the site root by Spring Boot.
COPY --from=frontend /web/dist/ ./src/main/resources/static/
RUN mvn -B clean package -DskipTests

# Stage 3: the runtime image, without Maven, Node or any source.
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
