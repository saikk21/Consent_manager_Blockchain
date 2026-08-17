exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.createType("policy_state", ["DRAFT", "PUBLISHED", "DEPRECATED"]);

  pgm.createTable("policy_artifacts", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    company_id: {
      type: "uuid",
      notNull: true,
      references: "companies(id)",
      onDelete: "CASCADE",
    },
    policy_ref: { type: "text", notNull: true },
    version: { type: "integer", notNull: true },
    state: { type: "policy_state", notNull: true, default: "DRAFT" },
    default_locale: { type: "text", notNull: true },
    required_legal_version: { type: "text", notNull: true },
    locales: { type: "jsonb", notNull: true },              // canonical content model
    policy_content_hash: { type: "text", notNull: true },   // deterministic hash of locales/default/legal version
    ui_schema_version: { type: "integer", notNull: true, default: 1 },
    published_at: { type: "timestamptz", notNull: false },
    deprecated_at: { type: "timestamptz", notNull: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("policy_artifacts", "policy_artifacts_identity_uniq", {
    unique: ["company_id", "policy_ref", "version"],
  });

  pgm.createIndex("policy_artifacts", ["company_id", "policy_ref"]);
  pgm.createIndex("policy_artifacts", ["company_id", "state", "created_at"]);

  // Immutability guard: prevent updates to PUBLISHED/DEPRECATED rows (except timestamps/state transitions).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_policy_mutation() RETURNS trigger AS $$
    BEGIN
      IF (OLD.state <> 'DRAFT') THEN
        -- Allow only state transitions + timestamp fields once published/deprecated
        IF (
          NEW.company_id IS DISTINCT FROM OLD.company_id OR
          NEW.policy_ref IS DISTINCT FROM OLD.policy_ref OR
          NEW.version IS DISTINCT FROM OLD.version OR
          NEW.default_locale IS DISTINCT FROM OLD.default_locale OR
          NEW.required_legal_version IS DISTINCT FROM OLD.required_legal_version OR
          NEW.locales IS DISTINCT FROM OLD.locales OR
          NEW.policy_content_hash IS DISTINCT FROM OLD.policy_content_hash OR
          NEW.ui_schema_version IS DISTINCT FROM OLD.ui_schema_version
        ) THEN
          RAISE EXCEPTION 'policy_artifacts row is immutable once state is %', OLD.state;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_prevent_policy_mutation ON policy_artifacts;
    CREATE TRIGGER trg_prevent_policy_mutation
      BEFORE UPDATE ON policy_artifacts
      FOR EACH ROW
      EXECUTE FUNCTION prevent_policy_mutation();
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_prevent_policy_mutation ON policy_artifacts;
    DROP FUNCTION IF EXISTS prevent_policy_mutation();
  `);
  pgm.dropTable("policy_artifacts");
  pgm.dropType("policy_state");
};

