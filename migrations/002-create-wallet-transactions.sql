CREATE TABLE IF NOT EXISTS wallet_transactions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('credit', 'debit') NOT NULL,
  status VARCHAR(50) NOT NULL,
  reference VARCHAR(255),
  provider VARCHAR(100),
  description VARCHAR(255),
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
