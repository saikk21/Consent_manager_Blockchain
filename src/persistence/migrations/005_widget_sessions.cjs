exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.createType("widget_session_state", [
    "ISSUED",
    "STARTED",
    "CONSUMED",
    "EXPIRED",
    "CANCELLED",
  ]);

  pgm.createTable("widget_sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    environment: { type: "text", notNull: true, default: "dev" },
    external_user_id: { type: "text", notNull: true },
    purpose_code: { type: "text", notNull: true },
    policy_ref: { type: "text", notNull: true },
    policy_version: { type: "integer", notNull: true },
    locale: { type: "text", notNull: true },
    allowed_origin: { type: "text", notNull: true },
    render_hash: { type: "text", notNull: true },
    status: { type: "widget_session_state", notNull: true, default: "ISSUED" },
    nonce: { type: "text", notNull: true },
    signing_kid: { type: "text", notNull: true },
    issued_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    started_at: { type: "timestamptz", notNull: false },
    consumed_at: { type: "timestamptz", notNull: false },
    expires_at: { type: "timestamptz", notNull: true },
    cancelled_at: { type: "timestamptz", notNull: false },
    idempotency_key: { type: "text", notNull: false },
    consent_id: { type: "uuid", notNull: false, references: "consents(id)", onDelete: "SET NULL" },
    consent_event_id: { type: "uuid", notNull: false, references: "events(id)", onDelete: "SET NULL" },
    consent_version_no: { type: "integer", notNull: false },
    current_status: { type: "text", notNull: false },
    failure_reason: { type: "text", notNull: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("widget_sessions", "widget_sessions_nonce_uniq", {
    unique: ["company_id", "nonce"],
  });
  pgm.createIndex("widget_sessions", ["company_id", "status", "expires_at"]);
  pgm.createIndex("widget_sessions", ["company_id", "external_user_id", "purpose_code", "created_at"]);
};

exports.down = async (pgm) => {
  pgm.dropTable("widget_sessions");
  pgm.dropType("widget_session_state");
};

