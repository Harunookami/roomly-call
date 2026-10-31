const STORAGE_KEY = "roomly:name";

export function loadUserName() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveUserName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Sem armazenamento (ex.: janela privada): o nome só não é lembrado.
  }
}
