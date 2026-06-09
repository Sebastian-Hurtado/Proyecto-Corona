CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  document_number TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  gender TEXT,
  dominant_hand TEXT,
  candidate_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  line_name TEXT,
  cargo_name TEXT,
  area_name TEXT,
  role_name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_aliases (
  id SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  normalized_source_name TEXT UNIQUE NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_assessments (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  source_role_name TEXT,
  normalized_source_role_name TEXT,
  line_name TEXT,
  source_record_number TEXT,
  assessment_date DATE,
  raw_assessment_date TEXT,
  overall_level_text TEXT,
  overall_level_value INTEGER,
  final_score NUMERIC(10, 2),
  complies BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, source_record_number)
);

CREATE TABLE IF NOT EXISTS skill_results (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES worker_assessments(id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL,
  source_label TEXT,
  level_text TEXT,
  level_value INTEGER,
  raw_score TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, skill_key)
);

CREATE TABLE IF NOT EXISTS role_requirements (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  source_role_name TEXT NOT NULL,
  normalized_source_role_name TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  weight NUMERIC(6, 4) NOT NULL DEFAULT 0,
  requirement_kind TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  desired_label TEXT,
  expected_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (normalized_source_role_name, skill_key)
);

CREATE TABLE IF NOT EXISTS anthropometric_profiles (
  id SERIAL PRIMARY KEY,
  line_name TEXT,
  variable_name TEXT NOT NULL,
  ideal_profile TEXT,
  exclusion_criteria TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (line_name, variable_name)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  import_type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_issues (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  sheet_name TEXT,
  row_number INTEGER,
  source_value TEXT,
  normalized_value TEXT,
  message TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_normalized_name ON roles(normalized_name);
CREATE INDEX IF NOT EXISTS idx_worker_assessments_role_id ON worker_assessments(role_id);
CREATE INDEX IF NOT EXISTS idx_worker_assessments_normalized_source_role_name ON worker_assessments(normalized_source_role_name);
CREATE INDEX IF NOT EXISTS idx_role_requirements_role_id ON role_requirements(role_id);
CREATE INDEX IF NOT EXISTS idx_role_requirements_normalized_source_role_name ON role_requirements(normalized_source_role_name);
CREATE INDEX IF NOT EXISTS idx_import_issues_batch_id ON import_issues(batch_id);
CREATE INDEX IF NOT EXISTS idx_role_aliases_normalized_source_name ON role_aliases(normalized_source_name);
