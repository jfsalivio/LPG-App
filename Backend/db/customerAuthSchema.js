// A separate account table keeps customer credentials out of staff User records.
module.exports = `CREATE TABLE IF NOT EXISTS CustomerAuth (
  CustomerID VARCHAR(20) PRIMARY KEY,
  Email VARCHAR(254) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_auth_customer FOREIGN KEY (CustomerID)
    REFERENCES Customer(CustomerID) ON DELETE CASCADE
)`;
