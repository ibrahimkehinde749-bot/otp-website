CREATE TABLE IF NOT EXISTS wallet_funding_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_reference VARCHAR(255),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @wallet_balance_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'wallet_balance'
);
SET @wallet_balance_sql = IF(
  @wallet_balance_exists = 0,
  'ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00',
  'SELECT 1'
);
PREPARE wallet_balance_stmt FROM @wallet_balance_sql;
EXECUTE wallet_balance_stmt;
DEALLOCATE PREPARE wallet_balance_stmt;

SET @role_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
);
SET @role_sql = IF(
  @role_exists = 0,
  'ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT ''user''',
  'SELECT 1'
);
PREPARE role_stmt FROM @role_sql;
EXECUTE role_stmt;
DEALLOCATE PREPARE role_stmt;
