import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/Setup.css";

// Interface for Rust event payload
interface InstallProgressPayload {
  progress: number;
  status: string;
  downloaded_bytes: number;
  total_bytes: number;
}

enum SetupStep {
  WELCOME = 0,
  LICENSE = 1,
  DESTINATION = 2,
  INSTALLING = 3,
  SUCCESS = 4,
}

function App() {
  const [step, setStep] = useState<SetupStep>(SetupStep.WELCOME);
  const [installDir, setInstallDir] = useState<string>("");
  const [licenseAccepted, setLicenseAccepted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("Pronto para iniciar");
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [launchOnFinish, setLaunchOnFinish] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appWindow = getCurrentWindow();

  useEffect(() => {
    // Get the default installation directory from Rust
    async function fetchDefaultDir() {
      try {
        const dir = await invoke<string>("get_default_install_dir");
        setInstallDir(dir);
      } catch (err) {
        console.error("Failed to get default install dir:", err);
      }
    }
    fetchDefaultDir();
  }, []);

  // Listen to install-progress events emitted by the Rust side
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    async function setupListener() {
      const unlisten = await listen<InstallProgressPayload>("install-progress", (event) => {
        const payload = event.payload;
        setProgress(payload.progress);
        setStatusText(payload.status);
        setDownloadedBytes(payload.downloaded_bytes);
        setTotalBytes(payload.total_bytes);
      });
      unsubscribe = unlisten;
    }

    setupListener();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChooseDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: installDir || undefined,
        title: "Selecionar Pasta de Instalação"
      });
      if (selected && typeof selected === "string") {
        setInstallDir(selected);
      }
    } catch (err) {
      console.error("Error opening directory dialog:", err);
    }
  };

  const handleStartInstallation = async () => {
    setStep(SetupStep.INSTALLING);
    setErrorMsg(null);
    setProgress(0);
    setStatusText("Inicializando instalação...");

    try {
      await invoke("install_launcher", { installDir });
      setStep(SetupStep.SUCCESS);
    } catch (err: any) {
      console.error("Installation failed:", err);
      setErrorMsg(err.toString() || "Ocorreu um erro desconhecido durante a instalação.");
      setStep(SetupStep.DESTINATION); // Fallback to destination to allow retry
    }
  };

  const handleFinish = async () => {
    if (launchOnFinish) {
      try {
        await invoke("launch_app", { installDir });
      } catch (err) {
        console.error("Failed to launch app:", err);
      }
    }
    handleClose();
  };

  // Convert bytes to MB formatted string
  const formatMB = (bytes: number) => {
    if (!bytes) return "0.0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const licenseText = `TERMOS DE USO E CONTRATO DE LICENÇA DO USUÁRIO FINAL (EULA)

Ao instalar e utilizar o Dominokas (doravante denominado "Software"), você concorda expressamente com os seguintes termos e condições:

1. LICENÇA DE USO: O Dominokas concede a você uma licença pessoal, não exclusiva, intransferível e limitada para fazer o download, instalar e executar o Software para fins de automação e integração com o jogo Deadlock (Citadel).

2. ISENÇÃO DE RESPONSABILIDADE: O Software é fornecido "no estado em que se encontra" (AS IS), sem garantias de qualquer tipo. O uso do Software é por sua conta e risco. O desenvolvedor não se responsabiliza por eventuais perdas de dados, banimentos ou sanções aplicadas por plataformas terceiras (incluindo a Valve Corporation / Steam).

3. INTEGRIDADE DOS DADOS: O Software realiza patches locais em arquivos como 'gameinfo.gi' para possibilitar a execução de plugins customizados. É de responsabilidade exclusiva do usuário garantir a cópia de segurança e a legalidade das operações.

4. SEGURANÇA E PRIVACIDADE: O Dominokas utiliza conexão segura de rede para sincronizar salas de draft e túneis de comunicação. Nenhum dado pessoal sensível é coletado sem o consentimento explícito do usuário.

Para prosseguir com a instalação, você deve concordar com os termos acima.`;

  return (
    <div className="installer-app">
      {/* Custom Titlebar */}
      <div className="installer-titlebar">
        <div className="titlebar-drag" data-tauri-drag-region>
          Dominokas Setup
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={handleMinimize} title="Minimizar">
            ─
          </button>
          <button className="titlebar-btn close" onClick={handleClose} title="Fechar">
            ✕
          </button>
        </div>
      </div>

      <div className="installer-layout">
        {/* Left Branding Column */}
        <div className="installer-sidebar">
          <div className="sidebar-glow-orb"></div>
          <div className="sidebar-logo-container">
            {/* Embedded custom elegant logo */}
            <svg className="logo-icon-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 2L60 18V50L32 62L4 50V18L32 2Z" stroke="#f0b90b" strokeWidth="2.5" strokeLinejoin="round" fill="rgba(240, 185, 11, 0.05)"/>
              <path d="M32 10L53 22V46L32 54L11 22V46L32 10Z" stroke="#f0b90b" strokeWidth="1" strokeDasharray="3 3"/>
              <circle cx="32" cy="32" r="12" stroke="#f0b90b" strokeWidth="2" fill="rgba(240, 185, 11, 0.15)"/>
              <path d="M32 20V44M20 32H44" stroke="#f0b90b" strokeWidth="1.5"/>
            </svg>
            <div className="logo-text">
              Domino<span>kas</span>
            </div>
            <div style={{fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em"}}>
              Deadlock Launcher
            </div>
          </div>
          <div className="sidebar-version">v1.0.0 Stable</div>
        </div>

        {/* Right Main Flow Panel */}
        <div className="installer-main-panel">
          {step === SetupStep.WELCOME && (
            <div className="screen-wrapper">
              <h2 className="screen-title">Bem-vindo ao Dominokas</h2>
              <p className="screen-description">
                O assistente de instalação configurará o Dominokas no seu computador. 
                O Dominokas é um launcher profissional de Deadlock que automatiza drafts, 
                gerencia salas de bans, cria túneis de conexão direta e injeta plugins Source 2 com facilidade.
              </p>
              
              <div className="welcome-bullets">
                <div className="bullet-item">
                  <div className="bullet-dot"></div>
                  <span>Instalação ultra-rápida e sem privilégios de administrador</span>
                </div>
                <div className="bullet-item">
                  <div className="bullet-dot"></div>
                  <span>Extração direta e atalhos na Área de Trabalho automáticos</span>
                </div>
                <div className="bullet-item">
                  <div className="bullet-dot"></div>
                  <span>Atualizações integradas e atualização automática de releases</span>
                </div>
              </div>

              <div className="installer-actions">
                <button className="btn-premium btn-secondary" onClick={handleClose}>
                  Cancelar
                </button>
                <button className="btn-premium btn-primary" onClick={() => setStep(SetupStep.LICENSE)}>
                  Iniciar Instalação
                </button>
              </div>
            </div>
          )}

          {step === SetupStep.LICENSE && (
            <div className="screen-wrapper">
              <h2 className="screen-title">Contrato de Licença</h2>
              <p className="screen-description" style={{marginBottom: "12px"}}>
                Leia atentamente os termos e condições antes de prosseguir com a instalação.
              </p>
              
              <div className="license-box">
                {licenseText}
              </div>

              <div 
                className={`checkbox-container ${licenseAccepted ? "checkbox-active" : ""}`}
                onClick={() => setLicenseAccepted(!licenseAccepted)}
              >
                <div className="checkbox-custom">
                  <div className="checkbox-checkmark"></div>
                </div>
                <span>Eu aceito os termos do contrato de licença</span>
              </div>

              <div className="installer-actions">
                <button className="btn-premium btn-secondary" onClick={() => setStep(SetupStep.WELCOME)}>
                  Voltar
                </button>
                <button 
                  className="btn-premium btn-primary" 
                  disabled={!licenseAccepted}
                  onClick={() => setStep(SetupStep.DESTINATION)}
                >
                  Avançar
                </button>
              </div>
            </div>
          )}

          {step === SetupStep.DESTINATION && (
            <div className="screen-wrapper">
              <h2 className="screen-title">Pasta de Destino</h2>
              <p className="screen-description" style={{marginBottom: "16px"}}>
                O assistente irá instalar o Dominokas na pasta especificada abaixo. 
                Para instalar em uma pasta diferente, clique em Alterar.
              </p>

              {errorMsg && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                  fontSize: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  lineHeight: "1.4"
                }}>
                  <strong>Erro na Instalação:</strong> {errorMsg}
                </div>
              )}
              
              <div className="destination-container">
                <input 
                  type="text" 
                  className="destination-input" 
                  value={installDir} 
                  onChange={(e) => setInstallDir(e.target.value)} 
                  placeholder="Selecione o diretório..."
                />
                <button className="destination-btn-change" onClick={handleChooseDirectory}>
                  📁 Alterar
                </button>
              </div>

              <div className="destination-warning">
                Espaço em disco necessário: aproximadamente 25 MB.<br/>
                Instalando na pasta Local AppData para evitar a necessidade de privilégios elevados (Admin).
              </div>

              <div className="installer-actions">
                <button className="btn-premium btn-secondary" onClick={() => setStep(SetupStep.LICENSE)}>
                  Voltar
                </button>
                <button className="btn-premium btn-primary" onClick={handleStartInstallation}>
                  Instalar Agora
                </button>
              </div>
            </div>
          )}

          {step === SetupStep.INSTALLING && (
            <div className="screen-wrapper">
              <h2 className="screen-title">Instalando o Dominokas</h2>
              <p className="screen-description">
                Por favor, aguarde enquanto o instalador baixa os arquivos da última versão 
                e realiza a extração do launcher no seu computador.
              </p>

              <div className="installation-flow">
                <div className="installation-status-row">
                  <span className="status-label">{statusText}</span>
                  <span className="status-percent">{Math.round(progress)}%</span>
                </div>

                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${progress}%` }}>
                    <div className="progress-bar-shimmer"></div>
                  </div>
                </div>

                <div className="installation-sub-details">
                  {totalBytes > 0 && `${formatMB(downloadedBytes)} / ${formatMB(totalBytes)}`}
                </div>
              </div>
            </div>
          )}

          {step === SetupStep.SUCCESS && (
            <div className="screen-wrapper">
              <div className="success-banner">
                <div className="success-icon-container">
                  <svg className="success-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="success-heading">Instalação Concluída!</h3>
                <p className="success-text">
                  O Dominokas foi instalado com sucesso no seu computador. 
                  Os atalhos foram criados na sua Área de Trabalho e no Menu Iniciar.
                </p>
              </div>

              <div 
                className={`checkbox-container ${launchOnFinish ? "checkbox-active" : ""}`}
                onClick={() => setLaunchOnFinish(!launchOnFinish)}
                style={{margin: "0 auto 16px auto"}}
              >
                <div className="checkbox-custom">
                  <div className="checkbox-checkmark"></div>
                </div>
                <span>Executar o Dominokas agora</span>
              </div>

              <div className="installer-actions" style={{justifyContent: "center"}}>
                <button className="btn-premium btn-primary" onClick={handleFinish} style={{width: "160px"}}>
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
