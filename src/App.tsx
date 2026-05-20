import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
      await invoke("minimize_window");
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  const handleClose = async () => {
    try {
      await invoke("close_window");
    } catch (err) {
      console.error("Failed to close window:", err);
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

  return (
    <div className="installer-app">
      {/* Background industrial Grid texture overlay */}
      <div className="texture-overlay"></div>

      {/* Camada 1: Top Bar Header (Window Controls & Technical Tagging) */}
      <header className="installer-header">
        <div className="header-drag" data-tauri-drag-region>
          <div className="header-brand">
            <div className="header-dot"></div>
            <span className="header-title">DEADLOCK INSTALLER // v1.0.4</span>
          </div>
        </div>
        
        <div className="header-controls">
          <button className="control-btn" onClick={handleMinimize} title="Minimizar">
            <svg className="control-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
            </svg>
          </button>
          
          <button className="control-btn close" onClick={handleClose} title="Fechar">
            <svg className="control-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Camada 2: Main Telemetry Body Area */}
      <section className="installer-body">
        {step === SetupStep.WELCOME && (
          <div className="screen-container">
            <div className="step-header">
              <h2 className="step-title">Bem-vindo ao Dominokas</h2>
              <p className="step-subtitle">ASSISTENTE DE INSTALAÇÃO DO CLIENT</p>
            </div>
            
            <div className="welcome-layout">
              <div className="welcome-logo-pod">
                <div className="logo-glow-ring"></div>
                <svg className="logo-vector-svg" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#f0b90b" opacity={1} stroke="none"
                    d=" M595.000000,621.999878   C595.000000,629.143250 595.000000,635.786682 595.000000,642.714233   C571.705383,642.714233 548.629944,642.714233 525.484497,642.714233   C505.165192,554.514893 484.829163,466.243042 464.493134,377.971161   C464.154510,378.012482 463.815887,378.053772 463.477264,378.095093   C463.477264,385.049805 463.450989,392.004700 463.500824,398.959045   C463.510071,400.251007 463.970795,401.539825 463.979095,402.831665   C464.336700,458.408630 464.709503,513.985596 464.980133,569.562988   C465.098206,593.805847 465.000000,618.049805 465.000000,642.647949   C444.512726,642.647949 423.108063,642.647949 401.000000,642.647949   C401.000000,641.337402 401.000000,639.757202 401.000000,638.177002   C401.000000,478.702179 401.020630,319.227295 400.898224,159.752579   C400.894623,155.071640 402.180450,153.839218 406.799103,153.893387   C427.619202,154.137604 448.443756,154.000000 469.773407,154.000000   C490.373596,242.679916 510.971710,331.351044 531.569824,420.022186   C532.046265,419.997009 532.522705,419.971832 532.999146,419.946655   C532.999146,416.107544 533.098755,412.265320 532.978882,408.429962   C532.710571,399.843628 532.148926,391.263000 532.042725,382.675903   C531.879944,369.513336 532.103699,356.346252 531.978455,343.182861   C531.716125,315.600677 531.347351,288.019409 530.995789,260.438141   C530.682373,235.855881 530.432007,211.272171 529.954285,186.692978   C529.745911,175.974213 529.039246,165.265121 528.545898,154.263184   C551.001404,154.263184 572.737793,154.263184 595.000000,154.263184   C595.000000,310.011993 595.000000,465.755951 595.000000,621.999878  z" />
                  <path fill="#f0b90b" opacity={1} stroke="none"
                    d=" M207.000000,563.000000   C207.000000,426.551910 207.000000,290.603790 207.000000,154.242432   C208.536377,154.157547 209.962479,154.010834 211.388641,154.010071   C237.047607,153.996216 262.714447,153.610245 288.362946,154.128525   C307.438904,154.514008 326.063660,157.568985 342.366791,168.772034   C360.576416,181.285187 372.164368,198.369492 376.862640,219.839203   C378.697235,228.222809 379.827881,236.937241 379.873596,245.508499   C380.404663,345.063293 380.829407,444.619476 380.853943,544.175415   C380.858490,562.684204 378.312683,581.180725 369.486816,597.873413   C359.566711,616.635742 345.049286,630.382385 324.397614,637.406372   C311.809937,641.687622 299.115540,643.165161 285.964355,643.061157   C259.831146,642.854431 233.695114,643.000000 207.000000,643.000000   C207.000000,616.347595 207.000000,589.923767 207.000000,563.000000  M275.000000,506.500000   C275.000000,530.261475 275.000000,554.023010 275.000000,578.000000   C279.380463,578.000000 283.192780,577.958984 287.003937,578.007141   C303.197601,578.211609 310.789062,567.742432 310.829926,554.124939   C311.140564,450.636200 311.014130,347.146118 310.977814,243.656494   C310.974243,233.496033 304.678192,222.643951 297.135223,221.246155   C289.981598,219.920486 282.553436,220.076187 275.000000,219.563766   C275.000000,315.559418 275.000000,410.529724 275.000000,506.500000  z" />
                  <path fill="#f0b90b" opacity={1} stroke="none"
                    d=" M168.286713,250.347198   C172.337555,232.411896 176.554947,214.900589 179.881134,197.221634   C182.501816,183.292542 184.009583,169.154648 186.081238,155.119766   C186.178375,154.461685 186.954361,153.903793 187.324570,153.417053   C187.324570,319.157990 187.324570,484.841064 187.324570,650.524109   C186.998215,650.537964 186.671860,650.551819 186.345505,650.565674   C184.896210,639.858093 183.514496,629.140808 181.978958,618.445618   C180.380814,607.314270 178.907715,596.154358 176.891891,585.095947   C173.373444,565.794189 168.882385,546.755920 162.168961,528.225098   C154.835922,507.983978 145.622696,488.671326 133.924591,470.714355   C126.115021,458.726562 117.593933,446.910187 107.714661,436.628021   C90.948799,419.178436 70.138382,408.171326 45.837395,405.128418   C36.507053,403.960114 26.984108,404.333344 17.549490,403.988647   C16.742689,403.959167 15.940168,403.812561 14.972823,403.701721   C15.639211,399.522736 16.702393,397.061890 21.905134,396.835907   C51.102211,395.567780 77.812927,387.358612 100.585922,368.048218   C116.310814,354.714264 128.503052,338.741486 138.577103,320.928223   C149.957764,300.804596 159.179504,279.760559 166.062637,257.692413   C166.784576,255.377823 167.402679,253.030838 168.286713,250.347198  z" />
                  <path fill="#f0b90b" opacity={1} stroke="none"
                    d=" M626.961182,220.194885   C629.311035,230.400482 631.437378,240.222382 633.991272,249.931808   C639.372742,270.391876 647.546753,289.820007 657.027222,308.651154   C667.514465,329.482330 679.903503,349.114410 697.451721,364.885590   C714.123962,379.869537 733.415161,389.955322 755.574585,393.905884   C764.412720,395.481537 773.437683,396.013641 782.380249,396.996613   C786.887085,397.492004 785.797180,400.735016 785.995178,403.513214   C771.202881,402.058105 756.995789,403.649231 743.099487,407.498962   C720.065552,413.880249 701.516052,426.971252 686.071106,445.196960   C674.277283,459.113983 664.602600,474.347839 656.431091,490.429443   C644.965149,512.994751 635.763000,536.579285 630.359680,561.412842   C627.768066,573.323669 625.924866,585.407715 624.045471,597.460510   C621.834351,611.640686 619.960693,625.873413 617.890564,640.076050   C617.811707,640.617188 617.210205,641.082092 616.320129,642.326721   C616.320129,481.825531 616.320129,322.218262 616.320129,162.611008   C616.605713,162.530579 616.891235,162.450134 617.176819,162.369705   C617.784180,165.776642 618.433350,169.176743 618.991577,172.591736   C621.276367,186.568085 623.523804,200.550522 625.812805,214.526169   C626.100830,216.284775 626.554504,218.016220 626.961182,220.194885  z" />
                </svg>
              </div>
              
              <div className="welcome-info">
                <p className="info-lead">
                  O Dominokas é o launcher definitivo e profissional para Deadlock (Citadel), 
                  oferecendo gerenciamento automatizado de Matchmaking, Draft & Ban de heróis em tempo real, 
                  túneis seguros via PlayIt e injeção automática de plugins Source 2.
                </p>
                <div className="tech-grid">
                  <div className="tech-item">
                    <div className="tech-dot"></div>
                    <span className="tech-text">Instalação direta no AppData (Sem privilégios de Admin)</span>
                  </div>
                  <div className="tech-item">
                    <div className="tech-dot"></div>
                    <span className="tech-text">Otimizado para o ecossistema Steamworks e Deadlock</span>
                  </div>
                  <div className="tech-item">
                    <div className="tech-dot"></div>
                    <span className="tech-text">Gerenciamento automático de túneis e relays de match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === SetupStep.LICENSE && (
          <div className="screen-container">
            <div className="step-header">
              <h2 className="step-title">Contrato de Licença</h2>
              <p className="step-subtitle">POR FAVOR, REVISE OS TERMOS ANTES DE PROSSEGUIR</p>
            </div>
            
            <div className="license-view">
              <section>
                <span className="sec-title">1. Licença de Uso:</span>
                O Dominokas concede a você uma licença pessoal, não exclusiva, intransferível e limitada para fazer o download, instalar e executar o Software para fins de automação e integração com o jogo Deadlock (Citadel).
              </section>
              <section>
                <span className="sec-title">2. Isenção de Responsabilidade:</span>
                O Software é fornecido "no estado em que se encontra" (AS IS), sem garantias de qualquer tipo. O uso do Software é por sua conta e risco. O desenvolvedor não se responsabiliza por eventuais perdas de dados, banimentos ou sanções aplicadas por plataformas terceiras (incluindo a Valve Corporation / Steam).
              </section>
              <section>
                <span className="sec-title">3. Integridade dos Dados:</span>
                O Software realiza patches locais em arquivos como 'gameinfo.gi' para possibilitar a execução de plugins customizados. É de responsabilidade exclusiva do usuário garantir a cópia de segurança e a legalidade das operações.
              </section>
              <section>
                <span className="sec-title">4. Segurança e Privacidade:</span>
                O Dominokas utiliza conexão segura de rede para sincronizar salas de draft e túneis de comunicação. Nenhum dado pessoal sensível é coletado sem o consentimento explícito do usuário.
              </section>
            </div>

            <div 
              className={`cyber-checkbox-row ${licenseAccepted ? "checkbox-active" : ""}`}
              onClick={() => setLicenseAccepted(!licenseAccepted)}
            >
              <div className="cyber-checkbox-box">
                <div className="checkbox-check"></div>
              </div>
              <span className="checkbox-label">Eu aceito os termos e condições do contrato de licença</span>
            </div>
          </div>
        )}

        {step === SetupStep.DESTINATION && (
          <div className="screen-container">
            <div className="step-header">
              <h2 className="step-title">Pasta de Destino</h2>
              <p className="step-subtitle">ESCOLHA O DIRETÓRIO DE INSTALAÇÃO DO CLIENT</p>
            </div>
            
            <div className="destination-layout">
              {errorMsg && (
                <div className="installation-error-banner">
                  <strong>Erro de Instalação:</strong> {errorMsg}
                </div>
              )}

              <div className="dest-row">
                <div className="dest-icon-box">
                  <svg className="dest-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="dest-path-wrapper">
                  <input 
                    type="text" 
                    className="dest-input" 
                    value={installDir} 
                    onChange={(e) => setInstallDir(e.target.value)} 
                    placeholder="Selecione a pasta de destino..."
                  />
                  <button className="btn-cyber secondary" onClick={handleChooseDirectory} style={{height: "36px", padding: "0 16px"}}>
                    Alterar
                  </button>
                </div>
              </div>

              <div className="dest-alert-box">
                <svg className="alert-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="alert-content">
                  <span className="alert-text">
                    A instalação na pasta AppData/Local é altamente recomendada pois evita a necessidade de privilégios de administrador (UAC) e permite que o atualizador embutido funcione de forma autônoma e silenciosa.
                  </span>
                  <span className="alert-meta">Espaço necessário: ~25 MB // Tipo: Instalação Local</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === SetupStep.INSTALLING && (
          <div className="screen-container">
            <div className="step-header">
              <h2 className="step-title">Instalando Dominokas</h2>
              <p className="step-subtitle">BAIXANDO E EXTRAINDO RECURSOS TÁTICOS</p>
            </div>
            
            <div className="installing-layout">
              <div className="installing-loader-section">
                <div className="loader-pulse-ring"></div>
                <div className="loader-details">
                  <span className="loader-label">{statusText}</span>
                  <span className="loader-percent">{Math.round(progress)}%</span>
                </div>
              </div>

              <div className="progress-track-cyber">
                <div className="progress-fill-cyber" style={{ width: `${progress}%` }}>
                  <div className="progress-shimmer"></div>
                </div>
              </div>

              <div className="progress-meta">
                {totalBytes > 0 ? (
                  `${formatMB(downloadedBytes)} / ${formatMB(totalBytes)} transferidos`
                ) : (
                  "Conectando com o repositório de lançamentos..."
                )}
              </div>
            </div>
          </div>
        )}

        {step === SetupStep.SUCCESS && (
          <div className="screen-container">
            <div className="step-header">
              <h2 className="step-title" style={{color: "var(--color-green)"}}>Instalação Concluída</h2>
              <p className="step-subtitle">SISTEMA CONFIGURADO E PRONTO PARA AÇÃO</p>
            </div>
            
            <div className="success-layout">
              <div className="success-glow-pod">
                <svg className="success-check-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h3 className="success-title-main">Sincronização bem-sucedida!</h3>
              <p className="success-body-text">
                O launcher do Dominokas foi instalado e configurado perfeitamente no seu computador. 
                Atalhos na Área de Trabalho e no Menu Iniciar foram criados e ativados.
              </p>

              <div 
                className={`cyber-checkbox-row ${launchOnFinish ? "checkbox-active" : ""}`}
                onClick={() => setLaunchOnFinish(!launchOnFinish)}
                style={{alignSelf: "center", marginTop: "8px"}}
              >
                <div className="cyber-checkbox-box">
                  <div className="checkbox-check"></div>
                </div>
                <span className="checkbox-label">Executar o Dominokas Client agora</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Camada 3: Bottom Action Bar Footer */}
      <footer className="installer-footer">
        <div className="footer-brand">
          <span className="footer-brand-title">
            DOMINO<span>KAS</span>
          </span>
          <span className="footer-brand-sub">DEADLOCK CLIENT MANAGER</span>
        </div>

        <div className="footer-actions">
          {step === SetupStep.WELCOME && (
            <>
              <button className="btn-cyber secondary" onClick={handleClose}>
                Cancelar
              </button>
              <button className="btn-cyber primary" onClick={() => setStep(SetupStep.LICENSE)}>
                Avançar
              </button>
            </>
          )}

          {step === SetupStep.LICENSE && (
            <>
              <button className="btn-cyber secondary" onClick={() => setStep(SetupStep.WELCOME)}>
                Voltar
              </button>
              <button className="btn-cyber primary" disabled={!licenseAccepted} onClick={() => setStep(SetupStep.DESTINATION)}>
                Avançar
              </button>
            </>
          )}

          {step === SetupStep.DESTINATION && (
            <>
              <button className="btn-cyber secondary" onClick={() => setStep(SetupStep.LICENSE)}>
                Voltar
              </button>
              <button className="btn-cyber primary" onClick={handleStartInstallation}>
                Instalar
              </button>
            </>
          )}

          {step === SetupStep.INSTALLING && (
            <>
              <button className="btn-cyber secondary" disabled>
                Voltar
              </button>
              <button className="btn-cyber primary" disabled>
                Instalando...
              </button>
            </>
          )}

          {step === SetupStep.SUCCESS && (
            <button className="btn-cyber primary" onClick={handleFinish} style={{minWidth: "120px"}}>
              Concluir
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
