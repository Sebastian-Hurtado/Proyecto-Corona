import { useEffect, useState } from "react";
import {
  createManualWorker,
  createRoleAlias,
  deleteRoleAlias,
  getImportIssues,
  getRecommendations,
  getRoles,
  getWorker,
  getWorkers,
  uploadExcel,
} from "./api";

const TABS = [
  "Carga de datos",
  "Colaboradores",
  "Oficios",
  "Homologaciones",
  "Recomendaciones",
];

const RADAR_LEVELS = [1, 2, 3, 4, 5];

const MANUAL_SKILL_INPUT_GROUPS = [
  {
    key: "minnesota",
    label: "Minnesota",
    note: "Captura las rondas; el sistema calcula la suma total de cada bloque.",
    matrix: {
      rowHeader: "Bloque",
      columns: [
        { suffix: "Round1", label: "Ronda 1" },
        { suffix: "Round2", label: "Ronda 2" },
      ],
      rows: [
        { prefix: "placingDominant", label: "Colocacion dominante" },
        { prefix: "placingNonDominant", label: "Colocacion no dominante" },
        { prefix: "displacingDominant", label: "Desplazamiento dominante" },
        { prefix: "displacingNonDominant", label: "Desplazamiento no dominante" },
        { prefix: "rotation", label: "Rotacion" },
      ],
    },
    fields: [
      { key: "placingDominantRound1", label: "Colocacion dominante - Ronda 1" },
      { key: "placingDominantRound2", label: "Colocacion dominante - Ronda 2" },
      { key: "placingNonDominantRound1", label: "Colocacion no dominante - Ronda 1" },
      { key: "placingNonDominantRound2", label: "Colocacion no dominante - Ronda 2" },
      { key: "displacingDominantRound1", label: "Desplazamiento dominante - Ronda 1" },
      { key: "displacingDominantRound2", label: "Desplazamiento dominante - Ronda 2" },
      {
        key: "displacingNonDominantRound1",
        label: "Desplazamiento no dominante - Ronda 1",
      },
      {
        key: "displacingNonDominantRound2",
        label: "Desplazamiento no dominante - Ronda 2",
      },
      { key: "rotationRound1", label: "Rotacion - Ronda 1" },
      { key: "rotationRound2", label: "Rotacion - Ronda 2" },
    ],
  },
  {
    key: "purdue",
    label: "Purdue / Lumosity - Trenes",
    note: "Captura las rondas; el sistema calcula el promedio de cada bloque.",
    matrix: {
      rowHeader: "Bloque",
      columns: [
        { suffix: "Round1", label: "Ronda 1" },
        { suffix: "Round2", label: "Ronda 2" },
      ],
      rows: [
        { prefix: "rightHand", label: "Mano dominante" },
        { prefix: "leftHand", label: "Mano no dominante" },
        { prefix: "bothHands", label: "Ambas manos" },
        { prefix: "assembly", label: "Ensamble" },
      ],
    },
    fields: [
      { key: "rightHandRound1", label: "Mano dominante - Ronda 1" },
      { key: "rightHandRound2", label: "Mano dominante - Ronda 2" },
      { key: "leftHandRound1", label: "Mano no dominante - Ronda 1" },
      { key: "leftHandRound2", label: "Mano no dominante - Ronda 2" },
      { key: "bothHandsRound1", label: "Ambas manos - Ronda 1" },
      { key: "bothHandsRound2", label: "Ambas manos - Ronda 2" },
      { key: "assemblyRound1", label: "Ensamble - Ronda 1" },
      { key: "assemblyRound2", label: "Ensamble - Ronda 2" },
    ],
  },
  {
    key: "batak",
    label: "Batak",
    note: "Captura practica y rondas; el sistema calcula la puntuacion con el mayor valor.",
    fields: [
      { key: "practice", label: "Practica" },
      { key: "round1", label: "Ronda 1" },
      { key: "round2", label: "Ronda 2" },
    ],
  },
  {
    key: "dedos_sueltos",
    label: "Dedos Sueltos",
    note: "Captura si logra la meta y la puntuacion final de la prueba.",
    fields: [
      {
        key: "goalMet",
        label: "Logra la meta",
        type: "select",
        options: ["SI", "NO"],
      },
      { key: "score", label: "Puntuacion" },
    ],
  },
  {
    key: "sonda_espacial",
    label: "Sonda Espacial",
    note: "Captura practica y cinco rondas; el sistema calcula la puntuacion con la moda.",
    fields: [
      { key: "practice", label: "Practica" },
      { key: "round1", label: "Ronda 1" },
      { key: "round2", label: "Ronda 2" },
      { key: "round3", label: "Ronda 3" },
      { key: "round4", label: "Ronda 4" },
      { key: "round5", label: "Ronda 5" },
    ],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [rolesData, setRolesData] = useState({
    roles: [],
    unresolvedSources: [],
    aliases: [],
  });
  const [workers, setWorkers] = useState([]);
  const [workerDetail, setWorkerDetail] = useState(null);
  const [workerSearch, setWorkerSearch] = useState("");
  const [isManualWorkerFormOpen, setIsManualWorkerFormOpen] = useState(false);
  const [manualWorkerForm, setManualWorkerForm] = useState(() =>
    createEmptyManualWorkerForm()
  );
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [recommendationData, setRecommendationData] = useState(null);
  const [aliasSelections, setAliasSelections] = useState({});
  const [lastImport, setLastImport] = useState(null);
  const [importIssues, setImportIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshBaseData() {
    const [rolesPayload, workersPayload] = await Promise.all([getRoles(), getWorkers()]);
    setRolesData(rolesPayload);
    setWorkers(workersPayload.workers);

    if (!selectedRoleId && rolesPayload.roles[0]?.id) {
      setSelectedRoleId(String(rolesPayload.roles[0].id));
    }
  }

  const filteredWorkers = workers.filter((worker) => {
    const searchTerm = normalizeSearchValue(workerSearch);

    if (!searchTerm) {
      return true;
    }

    return [
      worker.full_name,
      worker.document_number,
      worker.matched_role_name,
      worker.source_role_name,
      worker.matched_area_name,
    ]
      .map(normalizeSearchValue)
      .some((value) => value.includes(searchTerm));
  });

  useEffect(() => {
    setLoading(true);
    refreshBaseData()
      .catch((requestError) => {
        setError(requestError.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setRecommendationData(null);
      return;
    }

    getRecommendations(selectedRoleId)
      .then(setRecommendationData)
      .catch((requestError) => setError(requestError.message));
  }, [selectedRoleId]);

  useEffect(() => {
    if (!message && !error) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [message, error]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await uploadExcel(file);
      setLastImport(payload);
      setMessage(`Archivo importado: ${file.name}`);
      const issuesPayload = await getImportIssues(payload.batchId);
      setImportIssues(issuesPayload.issues);
      await refreshBaseData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleLoadWorker(workerId) {
    setLoading(true);
    setError("");

    try {
      const payload = await getWorker(workerId);
      setWorkerDetail(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenManualWorkerForm() {
    setError("");
    setMessage("");
    setManualWorkerForm(createEmptyManualWorkerForm());
    setIsManualWorkerFormOpen(true);
  }

  function handleManualWorkerField(field, value) {
    if (error) {
      setError("");
    }

    setManualWorkerForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleManualWorkerSkillInput(skillKey, fieldKey, value) {
    if (error) {
      setError("");
    }

    setManualWorkerForm((current) => ({
      ...current,
      skillInputs: {
        ...current.skillInputs,
        [skillKey]: {
          ...current.skillInputs[skillKey],
          [fieldKey]: value,
        },
      },
    }));
  }

  async function handleManualWorkerSubmit(event) {
    event.preventDefault();

    const validationMessage = validateManualWorkerForm(manualWorkerForm);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const worker = await createManualWorker({
        documentNumber: manualWorkerForm.documentNumber,
        fullName: manualWorkerForm.fullName,
        gender: manualWorkerForm.gender,
        dominantHand: manualWorkerForm.dominantHand,
        candidateType: manualWorkerForm.candidateType,
        roleId: Number(manualWorkerForm.roleId),
        assessmentDate: manualWorkerForm.assessmentDate,
        complies: manualWorkerForm.complies === true,
        skillInputs: manualWorkerForm.skillInputs,
      });

      await refreshBaseData();
      setWorkerDetail(worker);
      setWorkerSearch(worker.document_number);
      setIsManualWorkerFormOpen(false);
      setManualWorkerForm(createEmptyManualWorkerForm());
      setMessage("Colaborador guardado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAlias(sourceName) {
    const roleId = aliasSelections[sourceName];
    if (!roleId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await createRoleAlias(sourceName, Number(roleId));
      setMessage(`Homologacion guardada para "${sourceName}".`);
      await refreshBaseData();

      if (lastImport?.batchId) {
        const issuesPayload = await getImportIssues(lastImport.batchId);
        setImportIssues(issuesPayload.issues);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAlias(alias) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await deleteRoleAlias(alias.id);
      setMessage(`Homologacion deshecha para "${alias.source_name}".`);
      await refreshBaseData();

      if (lastImport?.batchId) {
        const issuesPayload = await getImportIssues(lastImport.batchId);
        setImportIssues(issuesPayload.issues);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">
            <span className="brand-wordmark">corona</span>
            <span className="eyebrow-separator">|</span>
            <span>Talento operativo</span>
          </p>
          <h1>Cerebro Digital para talento operativo</h1>
          <p className="hero-copy">Gestion centralizada de oficios</p>
        </div>
        <div className="hero-metrics">
          <Metric label="Oficios" value={rolesData.roles.length} />
          <Metric label="Colaboradores" value={workers.length} />
          <Metric
            label="Pendientes"
            value={rolesData.unresolvedSources.length}
            tone={rolesData.unresolvedSources.length ? "warning" : "success"}
          />
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={tab === activeTab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      {(message || error || loading) && (
        <section className="status-row">
          {loading && <span className="status-chip info">Procesando...</span>}
          {message && <span className="status-chip success">{message}</span>}
          {error && <span className="status-chip danger">{error}</span>}
        </section>
      )}

      {isManualWorkerFormOpen && (
        <ManualWorkerDialog
          form={manualWorkerForm}
          roles={rolesData.roles}
          loading={loading}
          error={error}
          onClose={() => {
            setIsManualWorkerFormOpen(false);
            setError("");
          }}
          onFieldChange={handleManualWorkerField}
          onSkillInputChange={handleManualWorkerSkillInput}
          onSubmit={handleManualWorkerSubmit}
        />
      )}

      {activeTab === "Carga de datos" && (
        <section className="grid two-columns">
          <Panel title="Carga de Excel" subtitle="Sube los archivos de requisitos, diagnosticos o perfil antropometrico del piloto.">
            <label className="upload-card">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
              <span>Seleccionar archivo Excel</span>
              <small>Los puestos ya son fijos. Aqui solo cargas diagnosticos, requisitos y perfil antropometrico.</small>
            </label>

            {lastImport && (
              <div className="summary-card">
                <h3>Ultima importacion</h3>
                <p>
                  <strong>Tipo:</strong> {lastImport.importType}
                </p>
                <p>
                  <strong>Lote:</strong> {lastImport.batchId}
                </p>
                <pre>{JSON.stringify(lastImport.summary, null, 2)}</pre>
              </div>
            )}
          </Panel>

          <Panel title="Issues del lote" subtitle="Filas con problemas o roles sin match automatico.">
            <div className="issue-list">
              {importIssues.length === 0 && <EmptyState text="Aun no hay issues cargados." />}
              {importIssues.map((issue) => (
                <article key={issue.id} className="issue-card">
                  <div className="issue-topline">
                    <strong>{issue.issue_type}</strong>
                    <Badge tone={issue.resolved ? "success" : "warning"}>
                      {issue.resolved ? "Resuelto" : "Pendiente"}
                    </Badge>
                  </div>
                  <p>{issue.message}</p>
                  <small>
                    Fuente: {issue.source_value || "Sin fuente"} | Fila:{" "}
                    {issue.row_number || "N/A"}
                  </small>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {activeTab === "Colaboradores" && (
        <section className="grid two-columns">
          <Panel
            title="Listado de colaboradores"
            subtitle="Vista rapida de la ultima evaluacion disponible."
            actions={
              <button
                className="primary-action"
                type="button"
                onClick={handleOpenManualWorkerForm}
              >
                Ingresar colaborador
              </button>
            }
          >
            <div className="search-field">
              <label htmlFor="worker-search">Buscar colaborador</label>
              <input
                id="worker-search"
                type="search"
                value={workerSearch}
                onChange={(event) => setWorkerSearch(event.target.value)}
                placeholder="Nombre, cedula u oficio"
              />
            </div>

            <div className="stack-list">
              {filteredWorkers.length === 0 && (
                <EmptyState text="No hay colaboradores que coincidan con la busqueda." compact />
              )}
              {filteredWorkers.map((worker) => (
                <button
                  key={worker.id}
                  className="list-row"
                  type="button"
                  onClick={() => handleLoadWorker(worker.id)}
                >
                  <div>
                    <strong>{worker.full_name}</strong>
                    <p>{worker.document_number}</p>
                  </div>
                  <div className="list-meta">
                    <Badge>{worker.overall_level_text || "Sin nivel"}</Badge>
                    <span>
                      {worker.matched_role_name || worker.source_role_name || "Sin oficio"}
                    </span>
                    <small>{worker.matched_area_name || "Sin area"}</small>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Detalle del colaborador" subtitle="Resultados por prueba y oficio asociado.">
            {!workerDetail && <EmptyState text="Selecciona un colaborador para ver el detalle." />}
            {workerDetail && (
              <div className="detail-column">
                <div className="detail-header">
                  <h3>{workerDetail.full_name}</h3>
                  <p>
                    Cedula {workerDetail.document_number} | {workerDetail.gender || "Genero N/A"}
                  </p>
                </div>
                {workerDetail.assessments.map((assessment) => (
                  <article key={assessment.id} className="detail-card">
                    <div className="issue-topline">
                      <strong>{assessment.matched_role_name || assessment.source_role_name}</strong>
                      <Badge tone={complianceTone(assessment.complies)}>
                        {complianceLabel(assessment.complies)}
                      </Badge>
                    </div>
                    <p>Area: {assessment.matched_area_name || "Sin area"}</p>
                    <p>Nivel global: {assessment.overall_level_text || "Sin dato"}</p>
                    {assessment.skillComparisons?.length > 0 && (
                      <RadarChart comparisons={assessment.skillComparisons} />
                    )}
                    {assessment.skillComparisons?.length === 0 && assessment.matched_role_name && (
                      <div className="comparison-unavailable">
                        Este oficio todavia no tiene requisitos de pruebas cargados para
                        mostrar la comparacion visual.
                      </div>
                    )}
                    <div className="skill-grid">
                      {assessment.skills.map((skill) => (
                        <div key={skill.skill_key} className="skill-pill">
                          <strong>{skill.source_label}</strong>
                          <span>{skill.level_text || "Sin dato"}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}

                <RoleFitSummary matches={workerDetail.roleMatches || []} />
              </div>
            )}
          </Panel>
        </section>
      )}

      {activeTab === "Oficios" && (
        <section className="panel">
          <div className="role-grid">
            {rolesData.roles.map((role) => (
              <article key={role.id} className="role-card">
                <div className="issue-topline">
                  <h3>{role.role_name}</h3>
                  <Badge>{role.requirement_count} pruebas</Badge>
                </div>
                <p>
                  {role.line_name || "Sin linea"} | {role.area_name || "Sin area"}
                </p>
                <div className="requirement-list">
                  {role.requirements.length === 0 && (
                    <EmptyState text="Sin requisitos homologados todavia." compact />
                  )}
                  {role.requirements.map((requirement) => (
                    <div key={requirement.id} className="requirement-item">
                      <strong>{requirement.skill_key}</strong>
                      <span>
                        {requirement.desired_label} | {formatWeightAsPercent(requirement.weight)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "Homologaciones" && (
        <section className="panel">
          <div className="alias-grid">
            <Panel title="Fuentes pendientes" subtitle="Asocia nombres origen a oficios canonicos.">
              {rolesData.unresolvedSources.length === 0 && (
                <EmptyState text="No hay fuentes pendientes por homologar." />
              )}
              {rolesData.unresolvedSources.map((item) => (
                <div key={`${item.origin}-${item.source_role_name}`} className="alias-row">
                  <div>
                    <strong>{item.source_role_name}</strong>
                    <p>
                      {item.origin} | {item.usage_count} ocurrencias
                    </p>
                  </div>
                  <div className="alias-form">
                    <select
                      value={aliasSelections[item.source_role_name] || ""}
                      onChange={(event) =>
                        setAliasSelections((current) => ({
                          ...current,
                          [item.source_role_name]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona oficio</option>
                      {rolesData.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.area_name} - {role.role_name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => handleAlias(item.source_role_name)}>
                      Guardar
                    </button>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="Homologaciones activas" subtitle="Mapa ya resuelto entre nombres origen y catalogo.">
              {rolesData.aliases.length === 0 && <EmptyState text="Aun no hay homologaciones guardadas." />}
              {rolesData.aliases.map((alias) => (
                <div key={alias.id} className="issue-card">
                  <div className="alias-active-row">
                    <strong>{alias.source_name}</strong>
                    <div className="alias-active-actions">
                      <Badge tone="success">{alias.role_name}</Badge>
                      <button
                        className="secondary-action danger"
                        type="button"
                        onClick={() => handleDeleteAlias(alias)}
                      >
                        Deshacer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </section>
      )}

      {activeTab === "Recomendaciones" && (
        <section className="grid two-columns">
          <Panel title="Seleccion de oficio" subtitle="Escoge el rol objetivo para calcular el ranking.">
            <select
              className="role-select"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
            >
                      <option value="">Selecciona un oficio</option>
                      {rolesData.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.area_name} - {role.role_name}
                        </option>
                      ))}
                    </select>

            {recommendationData && (
              <div className="summary-card">
                <h3>{recommendationData.role.role_name}</h3>
                <p>
                  Area: {recommendationData.role.area_name || "Sin area"} | Linea:{" "}
                  {recommendationData.role.line_name || "Sin linea"}
                </p>
                <p>
                  {recommendationData.roleResolved
                    ? "El oficio tiene requisitos homologados y puede rankear candidatos."
                    : "Este oficio aun no tiene requisitos homologados completos."}
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Ranking de candidatos" subtitle="Prioriza aptos y marca brechas para entrenamiento.">
            {!recommendationData && <EmptyState text="Selecciona un oficio para calcular recomendaciones." />}
            {recommendationData && recommendationData.ranking.length === 0 && (
              <EmptyState text="Aun no hay evaluaciones para rankear." />
            )}
            <div className="stack-list">
              {recommendationData?.ranking.map((item) => (
                <article key={item.assessmentId} className="recommendation-card">
                  <div className="issue-topline">
                    <div>
                      <strong>{item.fullName}</strong>
                      <p>{item.documentNumber}</p>
                    </div>
                    <Badge tone={statusTone(item.status)}>
                      {recommendationStatusLabel(item.status)} | {item.score}
                    </Badge>
                  </div>
                  <p>Rol fuente: {item.sourceRoleName || "Sin rol fuente"}</p>
                  {item.skillComparisons?.length > 0 && (
                    <RadarChart comparisons={item.skillComparisons} />
                  )}
                  <div className="recommendation-columns">
                    <ReadableComparisonList
                      title="Puntos fuertes"
                      intro="Pruebas donde el candidato ya cumple el minimo esperado para el oficio."
                      emptyText="No hay puntos fuertes destacados."
                      items={item.strengths}
                      tone="success"
                    />
                    <ReadableComparisonList
                      title="Por reforzar"
                      intro="Pruebas que conviene trabajar antes de asignar o mover al candidato."
                      emptyText="No se encontraron aspectos criticos por reforzar."
                      items={item.gaps}
                      tone="warning"
                    />
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = "default" }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function EmptyState({ text, compact = false }) {
  return <div className={compact ? "empty compact" : "empty"}>{text}</div>;
}

function ManualSkillMatrix({ skill, values, onChange }) {
  return (
    <div
      className="manual-skill-matrix"
      style={{
        "--round-columns": skill.matrix.columns.length,
      }}
    >
      <div className="manual-skill-matrix-heading">
        <span>{skill.matrix.rowHeader}</span>
        {skill.matrix.columns.map((column) => (
          <span key={column.suffix}>{column.label}</span>
        ))}
      </div>

      {skill.matrix.rows.map((row) => (
        <div key={row.prefix} className="manual-skill-matrix-row">
          <strong>{row.label}</strong>
          {skill.matrix.columns.map((column) => {
            const fieldKey = `${row.prefix}${column.suffix}`;
            return (
              <input
                key={fieldKey}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values[fieldKey]}
                onChange={(event) =>
                  onChange(skill.key, fieldKey, event.target.value)
                }
                placeholder={column.label}
                aria-label={`${row.label} - ${column.label}`}
                required
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ManualSkillInput({ field, value, onChange }) {
  return (
    <label className="form-field">
      <span>{field.label}</span>
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        >
          <option value="">Selecciona</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Resultado"
          required
        />
      )}
    </label>
  );
}

function ManualWorkerDialog({
  form,
  roles,
  loading,
  error,
  onClose,
  onFieldChange,
  onSkillInputChange,
  onSubmit,
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-worker-title"
      >
        <div className="modal-topline">
          <div>
            <h2 id="manual-worker-title">Ingresar colaborador</h2>
            <p>Registra la persona y su evaluacion para usarla en recomendaciones.</p>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cerrar
          </button>
        </div>

        {error && <div className="form-alert">{error}</div>}

        <form className="manual-worker-form" onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <label className="form-field">
              <span>Cedula</span>
              <input
                type="text"
                value={form.documentNumber}
                onChange={(event) =>
                  onFieldChange("documentNumber", event.target.value)
                }
                placeholder="Ej. 1020304050"
                required
              />
            </label>

            <label className="form-field">
              <span>Nombre completo</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => onFieldChange("fullName", event.target.value)}
                placeholder="Ej. Ana Maria Perez"
                required
              />
            </label>

            <label className="form-field">
              <span>Genero</span>
              <select
                value={form.gender}
                onChange={(event) => onFieldChange("gender", event.target.value)}
                required
              >
                <option value="">Selecciona genero</option>
                <option value="FEMENINO">FEMENINO</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="OTRO">OTRO</option>
              </select>
            </label>

            <label className="form-field">
              <span>Mano dominante</span>
              <select
                value={form.dominantHand}
                onChange={(event) =>
                  onFieldChange("dominantHand", event.target.value)
                }
                required
              >
                <option value="">Selecciona mano dominante</option>
                <option value="DERECHA">DERECHA</option>
                <option value="IZQUIERDA">IZQUIERDA</option>
                <option value="AMBIDIESTRO">AMBIDIESTRO</option>
              </select>
            </label>

            <label className="form-field">
              <span>Tipo de candidato</span>
              <input
                type="text"
                value={form.candidateType}
                onChange={(event) =>
                  onFieldChange("candidateType", event.target.value)
                }
                placeholder="Interno, externo, aprendiz..."
                required
              />
            </label>

            <label className="form-field">
              <span>Fecha de evaluacion</span>
              <input
                type="date"
                value={form.assessmentDate}
                onChange={(event) =>
                  onFieldChange("assessmentDate", event.target.value)
                }
                required
              />
            </label>
          </div>

          <div className="form-section-heading">
            <h3>Evaluacion</h3>
          </div>

          <div className="form-grid">
            <label className="form-field wide">
              <span>Oficio evaluado</span>
              <select
                value={form.roleId}
                onChange={(event) => onFieldChange("roleId", event.target.value)}
                required
              >
                <option value="">Selecciona un oficio</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.area_name || "Sin area"} - {role.role_name}
                  </option>
                ))}
              </select>
            </label>

            <label
              className={`checkbox-field wide ${
                form.complies === true ? "is-positive" : "is-negative"
              }`}
            >
              <input
                type="checkbox"
                checked={form.complies === true}
                onChange={(event) =>
                  onFieldChange("complies", event.target.checked)
                }
              />
              <span>
                {form.complies === true
                  ? "Cumple perfil antropometrico"
                  : "No cumple perfil antropometrico"}
              </span>
              <small>
                {form.complies === true
                  ? "Se tendra en cuenta para recomendaciones segun sus pruebas."
                  : "No se recomendara para oficios aunque sus pruebas sean favorables."}
              </small>
            </label>
          </div>

          <div className="form-section-heading">
            <h3>Resultados por prueba</h3>
            <p>El sistema calcula la calificacion automaticamente con los rangos del Excel.</p>
          </div>

          <div className="manual-skill-groups">
            {MANUAL_SKILL_INPUT_GROUPS.map((skill) => (
              <section key={skill.key} className="manual-skill-card">
                <div className="manual-skill-header">
                  <h4>{skill.label}</h4>
                  <p>{skill.note}</p>
                </div>
                {skill.matrix ? (
                  <ManualSkillMatrix
                    skill={skill}
                    values={form.skillInputs[skill.key]}
                    onChange={onSkillInputChange}
                  />
                ) : (
                  <div className="skill-level-grid">
                    {skill.fields.map((field) => (
                      <ManualSkillInput
                        key={field.key}
                        field={field}
                        value={form.skillInputs[skill.key][field.key]}
                        onChange={(value) =>
                          onSkillInputChange(skill.key, field.key, value)
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className="form-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button className="primary-action" type="submit" disabled={loading}>
              Guardar colaborador
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RoleFitSummary({ matches }) {
  const visibleMatches = matches.slice(0, 5);

  return (
    <section className="role-fit-section">
      <div className="role-fit-header">
        <h3>Oficios recomendados para esta persona</h3>
        <p>
          Comparacion de la evaluacion mas reciente del colaborador contra los
          requisitos de cada oficio homologado.
        </p>
      </div>

      {visibleMatches.length === 0 && (
        <EmptyState text="Aun no hay oficios con requisitos suficientes para comparar." compact />
      )}

      {visibleMatches.map((match, index) => (
        <article key={match.roleId} className="role-fit-card">
          <div className="role-fit-topline">
            <div>
              <span className="role-fit-rank">#{index + 1}</span>
              <strong>{match.roleName}</strong>
              <p>
                {match.areaName || "Sin area"} | {match.lineName || "Sin linea"}
              </p>
            </div>
            <Badge tone={statusTone(match.status)}>
              {readableStatus(match.status)} | {match.score}
            </Badge>
          </div>

          <p className="role-fit-note">{roleFitNote(match.status)}</p>

          {match.skillComparisons?.length > 0 && (
            <RadarChart comparisons={match.skillComparisons} />
          )}

          <div className="role-fit-evidence">
            <div>
              <h4>Lo que favorece el encaje</h4>
              {match.strengths.length === 0 && <small>Sin fortalezas destacadas.</small>}
              {match.strengths.slice(0, 2).map((strength) => (
                <p key={strength.label}>
                  {strength.label}: nivel obtenido {strength.currentLevelText}
                </p>
              ))}
            </div>
            <div>
              <h4>Lo que habria que revisar</h4>
              {match.gaps.length === 0 && <small>Sin brechas criticas.</small>}
              {match.gaps.slice(0, 2).map((gap) => (
                <p key={gap.label}>
                  {gap.label}: obtenido {gap.currentLevelText}, esperado {gap.expectedLabel}
                </p>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ReadableComparisonList({ title, intro, emptyText, items, tone }) {
  const isPositive = tone === "success";

  return (
    <section className={`decision-block ${tone}`}>
      <div className="decision-block-header">
        <h4>{title}</h4>
        <p>{intro}</p>
      </div>

      {items.length === 0 && <div className="decision-empty">{emptyText}</div>}

      {items.map((item) => (
        <article key={item.label} className="decision-item">
          <div className="decision-item-topline">
            <strong>{item.label}</strong>
            <span>{isPositive ? "Cumple" : "Reforzar"}</span>
          </div>
          <p>
            {isPositive
              ? "El resultado esta dentro del nivel requerido para este oficio."
              : "El resultado esta por debajo del minimo esperado para este oficio."}
          </p>
          <dl>
            <div>
              <dt>Nivel obtenido</dt>
              <dd>{item.currentLevelText || "SIN DATO"}</dd>
            </div>
            <div>
              <dt>Nivel esperado</dt>
              <dd>{item.expectedLabel || "Sin dato"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}

function RadarChart({ comparisons }) {
  const centerX = 210;
  const centerY = 168;
  const radius = 102;
  const labelRadius = 134;

  if (!comparisons.length) {
    return null;
  }

  const polygonPoints = (valueSelector, fixedRadius = null) =>
    comparisons
      .map((item, index) => {
        const levelRadius =
          fixedRadius ?? (clampRadarLevel(valueSelector(item)) / 5) * radius;
        const point = radarPoint(index, comparisons.length, levelRadius, centerX, centerY);
        return `${point.x},${point.y}`;
      })
      .join(" ");

  return (
    <figure className="radar-card">
      <div className="radar-topline">
        <h4>Comparacion de pruebas</h4>
        <div className="radar-legend">
          <span>
            <i className="radar-swatch expected" />
            Esperado
          </span>
          <span>
            <i className="radar-swatch current" />
            Obtenido
          </span>
        </div>
      </div>
      <div className="radar-layout">
        <svg
          className="radar-svg"
          viewBox="0 0 420 340"
          role="img"
          aria-label="Radar de niveles esperados y obtenidos"
        >
          <title>Radar de niveles esperados y obtenidos</title>
          {RADAR_LEVELS.map((level) => (
            <polygon
              key={level}
              className="radar-grid"
              points={polygonPoints(() => level)}
            />
          ))}
          {RADAR_LEVELS.map((level) => {
            const y = centerY - (level / 5) * radius;
            return (
              <text key={level} className="radar-level-label" x={centerX + 5} y={y + 4}>
                {level}
              </text>
            );
          })}
          {comparisons.map((item, index) => {
            const outerPoint = radarPoint(index, comparisons.length, radius, centerX, centerY);
            const labelPoint = radarPoint(
              index,
              comparisons.length,
              labelRadius,
              centerX,
              centerY
            );
            return (
              <g key={item.skillKey}>
                <line
                  className="radar-axis"
                  x1={centerX}
                  y1={centerY}
                  x2={outerPoint.x}
                  y2={outerPoint.y}
                />
                <text
                  className="radar-label"
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={radarTextAnchor(labelPoint.x, centerX)}
                  dominantBaseline="middle"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
          <polygon
            className="radar-area expected"
            points={polygonPoints((item) => item.expectedLevel)}
          />
          <polygon
            className="radar-area current"
            points={polygonPoints((item) => item.currentLevel)}
          />
          {comparisons.map((item, index) => {
            const expectedPoint = radarPoint(
              index,
              comparisons.length,
              (clampRadarLevel(item.expectedLevel) / 5) * radius,
              centerX,
              centerY
            );
            const currentPoint = radarPoint(
              index,
              comparisons.length,
              (clampRadarLevel(item.currentLevel) / 5) * radius,
              centerX,
              centerY
            );
            return (
              <g key={`${item.skillKey}-points`}>
                <circle
                  className="radar-point expected"
                  cx={expectedPoint.x}
                  cy={expectedPoint.y}
                  r="3.5"
                />
                <circle
                  className="radar-point current"
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="3.5"
                />
              </g>
            );
          })}
        </svg>

        <div className="radar-details">
          {comparisons.map((item) => (
            <div key={`${item.skillKey}-detail`} className="radar-detail">
              <strong>{item.label}</strong>
              <span>
                {item.currentLevelText || "SIN DATO"} vs {item.expectedLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

function createEmptyManualWorkerForm() {
  return {
    documentNumber: "",
    fullName: "",
    gender: "",
    dominantHand: "",
    candidateType: "",
    roleId: "",
    assessmentDate: todayInputDate(),
    complies: true,
    skillInputs: Object.fromEntries(
      MANUAL_SKILL_INPUT_GROUPS.map((skill) => [
        skill.key,
        Object.fromEntries(skill.fields.map((field) => [field.key, ""])),
      ])
    ),
  };
}

function todayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function validateManualWorkerForm(form) {
  if (!form.documentNumber.trim()) {
    return "La cedula es obligatoria.";
  }

  if (!form.fullName.trim()) {
    return "El nombre es obligatorio.";
  }

  if (!form.gender) {
    return "Selecciona el genero.";
  }

  if (!form.dominantHand) {
    return "Selecciona la mano dominante.";
  }

  if (!form.candidateType.trim()) {
    return "El tipo de candidato es obligatorio.";
  }

  if (!form.assessmentDate) {
    return "La fecha de evaluacion es obligatoria.";
  }

  if (!form.roleId) {
    return "Selecciona un oficio.";
  }

  for (const skill of MANUAL_SKILL_INPUT_GROUPS) {
    for (const field of skill.fields) {
      const value = form.skillInputs[skill.key]?.[field.key];

      if (!String(value ?? "").trim()) {
        return `Completa ${field.label} en ${skill.label}.`;
      }
    }
  }

  return "";
}

function complianceTone(complies) {
  if (complies === true) return "success";
  if (complies === false) return "warning";
  return "info";
}

function complianceLabel(complies) {
  if (complies === true) return "Cumple";
  if (complies === false) return "No cumple";
  return "Pendiente";
}

function statusTone(status) {
  if (status === "apto") return "success";
  if (status === "requiere reentrenamiento") return "warning";
  if (status === "pendiente homologacion") return "info";
  if (status === "no cumple perfil") return "danger";
  return "danger";
}

function recommendationStatusLabel(status) {
  if (status === "requiere reentrenamiento") return "requiere entrenamiento";
  if (status === "no cumple perfil") return "no cumple perfil";
  return status;
}

function readableStatus(status) {
  if (status === "apto") return "Apto";
  if (status === "requiere reentrenamiento") return "Requiere refuerzo";
  if (status === "pendiente homologacion") return "Pendiente";
  if (status === "no cumple perfil") return "No cumple perfil";
  return "No recomendado";
}

function roleFitNote(status) {
  if (status === "apto") {
    return "Buen candidato para considerar en este oficio con la informacion disponible.";
  }

  if (status === "requiere reentrenamiento") {
    return "Puede ser una alternativa si se refuerzan las pruebas marcadas antes del cambio.";
  }

  if (status === "pendiente homologacion") {
    return "Faltan requisitos homologados para comparar este oficio con confianza.";
  }

  if (status === "no cumple perfil") {
    return "No se recomienda asignar a este oficio porque no cumple el perfil antropometrico.";
  }

  return "No es la mejor opcion para este oficio segun la evaluacion actual.";
}

function formatWeightAsPercent(weight) {
  const numericWeight = Number(weight || 0);
  return `${Math.round(numericWeight * 100)}%`;
}

function clampRadarLevel(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(5, Math.max(0, numericValue));
}

function radarPoint(index, total, pointRadius, centerX, centerY) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: centerX + Math.cos(angle) * pointRadius,
    y: centerY + Math.sin(angle) * pointRadius,
  };
}

function radarTextAnchor(x, centerX) {
  if (x > centerX + 8) return "start";
  if (x < centerX - 8) return "end";
  return "middle";
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default App;
