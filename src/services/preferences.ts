export type ScreenResolution = 720 | 1080;
export type ScreenFps = 15 | 30 | 60;

export type Preferences = {
  micId: string;
  cameraId: string;
  speakerId: string;
  pushToTalk: boolean;
  pushToTalkKey: string;
  soundsEnabled: boolean;
  screenResolution: ScreenResolution;
  screenFps: ScreenFps;
};

const STORAGE_KEY = "roomly:preferences";

// Id vazio significa usar o dispositivo padrão do sistema.
const DEFAULTS: Preferences = {
  micId: "",
  cameraId: "",
  speakerId: "",
  pushToTalk: false,
  pushToTalkKey: "KeyV",
  soundsEnabled: true,
  screenResolution: 1080,
  screenFps: 30,
};

// KeyV vira "V" e Digit1 vira "1"; as demais teclas mantêm o nome do navegador.
export function keyLabel(code: string) {
  return code === "Space" ? "Espaço" : code.replace(/^(Key|Digit)/, "");
}

export function loadPreferences(): Preferences {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Sem armazenamento (ex.: janela privada): vale só até fechar a página.
  }
}
