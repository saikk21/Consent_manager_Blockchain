exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.createType("proof_batch_state", ["OPEN", "SEALED", "ANCHORED", "FAILED"]);
  pgm.createType("proof_anchor_status", ["NOT_SENT", "SENT", "CONFIRMED", "FAILED"]);

  pgm.createTable("proof_batches", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    batch_no: { type: "bigserial", notNull: true, unique: true },
    state: { type: "proof_batch_state", notNull: true, default: "OPEN" },
    event_count: { type: "integer", notNull: true, default: 0 },
    tree_algo: { type: "text", notNull: true, default: "MERKLE_SHA256_V1" },
    root_hash: { type: "text", notNull: false },
    sealed_at: { type: "timestamptz", notNull: false },
    anchor_mode: { type: "text", notNull: true, default: "MOCK" },
    anchor_status: { type: "proof_anchor_status", notNull: true, default: "NOT_SENT" },
    anchor_ref: { type: "text", notNull: false },
    anchor_sent_at: { type: "timestamptz", notNull: false },
    anchor_confirmed_at: { type: "timestamptz", notNull: false },
    anchor_failed_at: { type: "timestamptz", notNull: false },
    failure_reason: { type: "text", notNull: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("proof_batches", ["state", "created_at"]);
  pgm.createIndex("proof_batches", ["anchor_status", "created_at"]);

  pgm.createTable("proof_batch_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    proof_batch_id: {
      type: "uuid",
      notNull: true,
      references: "proof_batches(id)",
      onDelete: "CASCADE",
    },
    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "RESTRICT",
      unique: true,
    },
    leaf_index: { type: "integer", notNull: true },
    leaf_hash: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("proof_batch_events", "proof_batch_events_batch_leaf_uniq", {
    unique: ["proof_batch_id", "leaf_index"],
  });
  pgm.createIndex("proof_batch_events", ["proof_batch_id"]);
  pgm.createIndex("proof_batch_events", ["event_id"]);

  pgm.createTable("proof_paths", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "RESTRICT",
      unique: true,
    },
    proof_batch_id: {
      type: "uuid",
      notNull: true,
      references: "proof_batches(id)",
      onDelete: "CASCADE",
    },
    root_hash: { type: "text", notNull: true },
    path_hashes: { type: "jsonb", notNull: true },
    path_positions: { type: "jsonb", notNull: true },
    algo_version: { type: "text", notNull: true, default: "MERKLE_SHA256_V1" },
    generated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("proof_paths", ["proof_batch_id"]);
  pgm.createIndex("proof_paths", ["event_id"]);

  pgm.addConstraint("events", "events_proof_batch_fk", {
    foreignKeys: {
      columns: "proof_batch_id",
      references: "proof_batches(id)",
      onDelete: "SET NULL",
    },
  });
}

exports.down = async (pgm) => {
  pgm.dropConstraint("events", "events_proof_batch_fk");
  pgm.dropTable("proof_paths");
  pgm.dropTable("proof_batch_events");
  pgm.dropTable("proof_batches");
  pgm.dropType("proof_anchor_status");
  pgm.dropType("proof_batch_state");
};

