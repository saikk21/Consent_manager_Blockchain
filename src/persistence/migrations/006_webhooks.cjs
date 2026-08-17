exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.createType("webhook_endpoint_status", ["ACTIVE", "PAUSED"]);
  pgm.createType("webhook_delivery_status", ["PENDING", "CLAIMED", "DELIVERED", "DEAD_LETTER"]);

  pgm.createTable("webhook_endpoints", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    environment: { type: "text", notNull: true, default: "dev" },
    url: { type: "text", notNull: true },
    subscribed_events: { type: "jsonb", notNull: true },
    status: { type: "webhook_endpoint_status", notNull: true, default: "ACTIVE" },
    signing_secret: { type: "text", notNull: true },
    previous_signing_secret: { type: "text", notNull: false },
    secret_rotated_at: { type: "timestamptz", notNull: false },
    signature_algorithm: { type: "text", notNull: true, default: "HMAC_SHA256_V1" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("webhook_endpoints", ["company_id", "status", "created_at"]);
  pgm.createIndex("webhook_endpoints", ["company_id", "environment", "created_at"]);

  pgm.createTable("webhook_deliveries", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    endpoint_id: {
      type: "uuid",
      notNull: true,
      references: "webhook_endpoints(id)",
      onDelete: "CASCADE",
    },
    event_id: { type: "uuid", notNull: true },
    event_type: { type: "text", notNull: true },
    payload: { type: "jsonb", notNull: true },
    status: { type: "webhook_delivery_status", notNull: true, default: "PENDING" },
    attempt_count: { type: "integer", notNull: true, default: 0 },
    max_attempts: { type: "integer", notNull: true, default: 10 },
    next_attempt_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_error: { type: "text", notNull: false },
    last_http_status: { type: "integer", notNull: false },
    signature_header: { type: "text", notNull: false },
    signature_timestamp: { type: "bigint", notNull: false },
    claimed_at: { type: "timestamptz", notNull: false },
    delivered_at: { type: "timestamptz", notNull: false },
    dead_lettered_at: { type: "timestamptz", notNull: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("webhook_deliveries", "webhook_deliveries_endpoint_event_uniq", {
    unique: ["endpoint_id", "event_id"],
  });

  pgm.createIndex("webhook_deliveries", ["status", "next_attempt_at"]);
  pgm.createIndex("webhook_deliveries", ["company_id", "event_type", "created_at"]);
  pgm.createIndex("webhook_deliveries", ["endpoint_id", "created_at"]);
};

exports.down = async (pgm) => {
  pgm.dropTable("webhook_deliveries");
  pgm.dropTable("webhook_endpoints");
  pgm.dropType("webhook_delivery_status");
  pgm.dropType("webhook_endpoint_status");
};

