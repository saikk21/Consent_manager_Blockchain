exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.createTable("company_api_keys", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    key_prefix: { type: "text", notNull: true },
    key_hash: { type: "text", notNull: true },
    status: { type: "text", notNull: true, default: "ACTIVE" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    revoked_at: { type: "timestamptz", notNull: false },
    last_used_at: { type: "timestamptz", notNull: false },
  });

  pgm.addConstraint("company_api_keys", "company_api_keys_hash_uniq", {
    unique: ["key_hash"],
  });

  pgm.createIndex("company_api_keys", ["company_id", "status"]);
  pgm.createIndex("company_api_keys", ["key_prefix"]);
};

exports.down = async (pgm) => {
  pgm.dropTable("company_api_keys");
};

