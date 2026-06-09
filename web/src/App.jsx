import { useEffect, useState } from "react";
import {
  createRoleAlias,
  getImportIssues,
  getRecommendations,
  getRoles,
  getWorker,
  getWorkers,
  uploadExcel,
} from "./api";

const TABS = [
  "Carga de datos",
  "Trabajadores",
  "Oficios",
  "Homologaciones",
  "Recomendaciones",
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Corona Talent Prototype</p>
          <h1>Cerebro Digital para talento operativo</h1>
          <p className="hero-copy">
            Consolida oficios, evaluaciones y brechas de habilidades para recomendar
            el mejor perfil disponible en la linea One Piece.
          </p>
        </div>
        <div className="hero-metrics">
          <Metric label="Oficios" value={rolesData.roles.length} />
          <Metric label="Trabajadores" value={workers.length} />
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

      {activeTab === "Trabajadores" && (
        <section className="grid two-columns">
          <Panel title="Listado de trabajadores" subtitle="Vista rapida de la ultima evaluacion disponible.">
            <div className="stack-list">
              {workers.map((worker) => (
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

          <Panel title="Detalle del trabajador" subtitle="Resultados por prueba y oficio asociado.">
            {!workerDetail && <EmptyState text="Selecciona un trabajador para ver el detalle." />}
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
                      <Badge tone={assessment.complies ? "success" : "warning"}>
                        {assessment.complies ? "Cumple" : "No cumple"}
                      </Badge>
                    </div>
                    <p>Area: {assessment.matched_area_name || "Sin area"}</p>
                    <p>Nivel global: {assessment.overall_level_text || "Sin dato"}</p>
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
                  <div className="issue-topline">
                    <strong>{alias.source_name}</strong>
                    <Badge tone="success">{alias.role_name}</Badge>
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

          <Panel title="Ranking de candidatos" subtitle="Prioriza aptos y marca brechas para reentrenamiento.">
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
                      {item.status} | {item.score}
                    </Badge>
                  </div>
                  <p>Rol fuente: {item.sourceRoleName || "Sin rol fuente"}</p>
                  <div className="recommendation-columns">
                    <div>
                      <h4>Fortalezas</h4>
                      {item.strengths.length === 0 && <small>Sin fortalezas destacadas.</small>}
                      {item.strengths.map((strength) => (
                        <p key={strength.label}>
                          {strength.label}: {strength.currentLevelText} vs {strength.expectedLabel}
                        </p>
                      ))}
                    </div>
                    <div>
                      <h4>Brechas</h4>
                      {item.gaps.length === 0 && <small>Sin brechas criticas.</small>}
                      {item.gaps.map((gap) => (
                        <p key={gap.label}>
                          {gap.label}: {gap.currentLevelText} vs {gap.expectedLabel}
                        </p>
                      ))}
                    </div>
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

function Panel({ title, subtitle, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
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

function statusTone(status) {
  if (status === "apto") return "success";
  if (status === "requiere reentrenamiento") return "warning";
  if (status === "pendiente homologacion") return "info";
  return "danger";
}

function formatWeightAsPercent(weight) {
  const numericWeight = Number(weight || 0);
  return `${Math.round(numericWeight * 100)}%`;
}

export default App;
