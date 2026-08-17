exports.shorthands = undefined;

exports.up = async (pgm) => {
  // Needed for gen_random_uuid() on many Postgres installations.
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("companies", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // Consents are timelines identified by (company, external_user_id, purpose_code).
  pgm.createTable("consents", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    external_user_id: { type: "text", notNull: true },
    purpose_code: { type: "text", notNull: true },
    current_version_no: { type: "integer", notNull: true, default: 0 },
    current_status: { type: "text", notNull: true, default: "NONE" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("consents", "consents_identity_uniq", {
    unique: ["company_id", "external_user_id", "purpose_code"],
  });

  pgm.createIndex("consents", ["company_id", "external_user_id", "purpose_code"]);

  pgm.createTable("events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    consent_id: {
      type: "uuid",
      notNull: true,
      references: "consents(id)",
      onDelete: "CASCADE",
    },
    event_type: { type: "text", notNull: true },
    version_no: { type: "integer", notNull: true },
    event_hash: { type: "text", notNull: true },
    recorded_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    proof_status: { type: "text", notNull: true, default: "PENDING" },
    proof_batch_id: { type: "uuid", notNull: false },
  });

  pgm.addConstraint("events", "events_per_version_uniq", {
    unique: ["consent_id", "version_no"],
  });

  pgm.createIndex("events", ["company_id", "recorded_at"]);
  pgm.createIndex("events", ["consent_id", "version_no"]);
  pgm.createIndex("events", ["proof_status", "recorded_at"]);

  pgm.createTable("consent_versions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    consent_id: {
      type: "uuid",
      notNull: true,
      references: "consents(id)",
      onDelete: "CASCADE",
    },
    version_no: { type: "integer", notNull: true },
    action: { type: "text", notNull: true },
    policy_ref: { type: "text", notNull: true },
    occurred_at: { type: "timestamptz", notNull: true },
    recorded_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "RESTRICT",
      unique: true,
    },
  });

  pgm.addConstraint("consent_versions", "consent_versions_uniq", {
    unique: ["consent_id", "version_no"],
  });

  pgm.createIndex("consent_versions", ["consent_id", "version_no"]);

  pgm.createTable("idempotency_keys", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    idempotency_key: { type: "text", notNull: true },
    request_hash: { type: "text", notNull: true },
    status: { type: "text", notNull: true, default: "IN_PROGRESS" },
    response_code: { type: "integer", notNull: false },
    response_body: { type: "jsonb", notNull: false },
    consent_id: { type: "uuid", notNull: false, references: "consents(id)", onDelete: "SET NULL" },
    event_id: { type: "uuid", notNull: false, references: "events(id)", onDelete: "SET NULL" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
  });

  pgm.addConstraint("idempotency_keys", "idempotency_keys_uniq", {
    unique: ["company_id", "idempotency_key"],
  });

  pgm.createIndex("idempotency_keys", ["company_id", "idempotency_key"]);
  pgm.createIndex("idempotency_keys", ["expires_at"]);

  pgm.createTable("outbox", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    topic: { type: "text", notNull: true },
    aggregate_type: { type: "text", notNull: true },
    aggregate_id: { type: "uuid", notNull: true },
    payload: { type: "jsonb", notNull: true },
    status: { type: "text", notNull: true, default: "NEW" },
    attempt_count: { type: "integer", notNull: true, default: 0 },
    next_attempt_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_error: { type: "text", notNull: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    claimed_at: { type: "timestamptz", notNull: false },
    processed_at: { type: "timestamptz", notNull: false },
  });

  pgm.createIndex("outbox", ["status", "next_attempt_at"]);
  pgm.createIndex("outbox", ["created_at"]);
};

exports.down = async (pgm) => {
  pgm.dropTable("outbox");
  pgm.dropTable("idempotency_keys");
  pgm.dropTable("consent_versions");
  pgm.dropTable("events");
  pgm.dropTable("consents");
  pgm.dropTable("companies");
};

