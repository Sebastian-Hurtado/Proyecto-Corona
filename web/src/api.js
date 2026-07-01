const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "La solicitud fallo.");
  }

  return payload;
}

export async function getRoles() {
  const response = await fetch(`${API_URL}/roles`);
  return parseResponse(response);
}

export async function getWorkers() {
  const response = await fetch(`${API_URL}/workers`);
  return parseResponse(response);
}

export async function getWorker(workerId) {
  const response = await fetch(`${API_URL}/workers/${workerId}`);
  return parseResponse(response);
}

export async function getRecommendations(roleId) {
  const response = await fetch(`${API_URL}/recommendations?roleId=${roleId}`);
  return parseResponse(response);
}

export async function createRoleAlias(sourceName, roleId) {
  const response = await fetch(`${API_URL}/role-aliases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceName, roleId }),
  });

  return parseResponse(response);
}

export async function deleteRoleAlias(aliasId) {
  const response = await fetch(`${API_URL}/role-aliases/${aliasId}`, {
    method: "DELETE",
  });

  return parseResponse(response);
}

export async function uploadExcel(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/imports/excel`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}

export async function getImportIssues(batchId) {
  const response = await fetch(`${API_URL}/imports/${batchId}/issues`);
  return parseResponse(response);
}
