-- DoStuff database schema
-- This script runs automatically when the MySQL container starts with an empty data directory.

CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)                              NOT NULL,
    priority    ENUM('low', 'medium', 'high')             NOT NULL DEFAULT 'medium',
    deadline    DATE,
    completed   TINYINT(1)                                NOT NULL DEFAULT 0,
    created_at  TIMESTAMP                                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP                                 NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
