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
            <svg className="logo-icon-svg" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFFFFF" opacity={1} stroke="none"
                d=" M595.000000,621.999878   C595.000000,629.143250 595.000000,635.786682 595.000000,642.714233   C571.705383,642.714233 548.629944,642.714233 525.484497,642.714233   C505.165192,554.514893 484.829163,466.243042 464.493134,377.971161   C464.154510,378.012482 463.815887,378.053772 463.477264,378.095093   C463.477264,385.049805 463.450989,392.004700 463.500824,398.959045   C463.510071,400.251007 463.970795,401.539825 463.979095,402.831665   C464.336700,458.408630 464.709503,513.985596 464.980133,569.562988   C465.098206,593.805847 465.000000,618.049805 465.000000,642.647949   C444.512726,642.647949 423.108063,642.647949 401.000000,642.647949   C401.000000,641.337402 401.000000,639.757202 401.000000,638.177002   C401.000000,478.702179 401.020630,319.227295 400.898224,159.752579   C400.894623,155.071640 402.180450,153.839218 406.799103,153.893387   C427.619202,154.137604 448.443756,154.000000 469.773407,154.000000   C490.373596,242.679916 510.971710,331.351044 531.569824,420.022186   C532.046265,419.997009 532.522705,419.971832 532.999146,419.946655   C532.999146,416.107544 533.098755,412.265320 532.978882,408.429962   C532.710571,399.843628 532.148926,391.263000 532.042725,382.675903   C531.879944,369.513336 532.103699,356.346252 531.978455,343.182861   C531.716125,315.600677 531.347351,288.019409 530.995789,260.438141   C530.682373,235.855881 530.432007,211.272171 529.954285,186.692978   C529.745911,175.974213 529.039246,165.265121 528.545898,154.263184   C551.001404,154.263184 572.737793,154.263184 595.000000,154.263184   C595.000000,310.011993 595.000000,465.755951 595.000000,621.999878  z" />
              <path fill="#FFFFFF" opacity={1} stroke="none"
                d=" M207.000000,563.000000   C207.000000,426.551910 207.000000,290.603790 207.000000,154.242432   C208.536377,154.157547 209.962479,154.010834 211.388641,154.010071   C237.047607,153.996216 262.714447,153.610245 288.362946,154.128525   C307.438904,154.514008 326.063660,157.568985 342.366791,168.772034   C360.576416,181.285187 372.164368,198.369492 376.862640,219.839203   C378.697235,228.222809 379.827881,236.937241 379.873596,245.508499   C380.404663,345.063293 380.829407,444.619476 380.853943,544.175415   C380.858490,562.684204 378.312683,581.180725 369.486816,597.873413   C359.566711,616.635742 345.049286,630.382385 324.397614,637.406372   C311.809937,641.687622 299.115540,643.165161 285.964355,643.061157   C259.831146,642.854431 233.695114,643.000000 207.000000,643.000000   C207.000000,616.347595 207.000000,589.923767 207.000000,563.000000  M275.000000,506.500000   C275.000000,530.261475 275.000000,554.023010 275.000000,578.000000   C279.380463,578.000000 283.192780,577.958984 287.003937,578.007141   C303.197601,578.211609 310.789062,567.742432 310.829926,554.124939   C311.140564,450.636200 311.014130,347.146118 310.977814,243.656494   C310.974243,233.496033 304.678192,222.643951 297.135223,221.246155   C289.981598,219.920486 282.553436,220.076187 275.000000,219.563766   C275.000000,315.559418 275.000000,410.529724 275.000000,506.500000  z" />
              <path fill="#EFB810" opacity={1} stroke="none"
                d=" M168.286713,250.347198   C172.337555,232.411896 176.554947,214.900589 179.881134,197.221634   C182.501816,183.292542 184.009583,169.154648 186.081238,155.119766   C186.178375,154.461685 186.954361,153.903793 187.324570,153.417053   C187.324570,319.157990 187.324570,484.841064 187.324570,650.524109   C186.998215,650.537964 186.671860,650.551819 186.345505,650.565674   C184.896210,639.858093 183.514496,629.140808 181.978958,618.445618   C180.380814,607.314270 178.907715,596.154358 176.891891,585.095947   C173.373444,565.794189 168.882385,546.755920 162.168961,528.225098   C154.835922,507.983978 145.622696,488.671326 133.924591,470.714355   C126.115021,458.726562 117.593933,446.910187 107.714661,436.628021   C90.948799,419.178436 70.138382,408.171326 45.837395,405.128418   C36.507053,403.960114 26.984108,404.333344 17.549490,403.988647   C16.742689,403.959167 15.940168,403.812561 14.972823,403.701721   C15.639211,399.522736 16.702393,397.061890 21.905134,396.835907   C51.102211,395.567780 77.812927,387.358612 100.585922,368.048218   C116.310814,354.714264 128.503052,338.741486 138.577103,320.928223   C149.957764,300.804596 159.179504,279.760559 166.062637,257.692413   C166.784576,255.377823 167.402679,253.030838 168.286713,250.347198  z" />
              <path fill="#EFB810" opacity={1} stroke="none"
                d=" M626.961182,220.194885   C629.311035,230.400482 631.437378,240.222382 633.991272,249.931808   C639.372742,270.391876 647.546753,289.820007 657.027222,308.651154   C667.514465,329.482330 679.903503,349.114410 697.451721,364.885590   C714.123962,379.869537 733.415161,389.955322 755.574585,393.905884   C764.412720,395.481537 773.437683,396.013641 782.380249,396.996613   C786.887085,397.492004 785.797180,400.735016 785.995178,403.513214   C771.202881,402.058105 756.995789,403.649231 743.099487,407.498962   C720.065552,413.880249 701.516052,426.971252 686.071106,445.196960   C674.277283,459.113983 664.602600,474.347839 656.431091,490.429443   C644.965149,512.994751 635.763000,536.579285 630.359680,561.412842   C627.768066,573.323669 625.924866,585.407715 624.045471,597.460510   C621.834351,611.640686 619.960693,625.873413 617.890564,640.076050   C617.811707,640.617188 617.210205,641.082092 616.320129,642.326721   C616.320129,481.825531 616.320129,322.218262 616.320129,162.611008   C616.605713,162.530579 616.891235,162.450134 617.176819,162.369705   C617.784180,165.776642 618.433350,169.176743 618.991577,172.591736   C621.276367,186.568085 623.523804,200.550522 625.812805,214.526169   C626.100830,216.284775 626.554504,218.016220 626.961182,220.194885  z" />
              <path fill="#000000" opacity={0.25} stroke="none"
                d=" M275.000000,506.000000   C275.000000,410.529724 275.000000,315.559418 275.000000,219.563766   C282.553436,220.076187 289.981598,219.920486 297.135223,221.246155   C304.678192,222.643951 310.974243,233.496033 310.977814,243.656494   C311.014130,347.146118 311.014130,450.636200 310.829926,554.124939   C310.789062,567.742432 303.197601,578.211609 287.003937,578.007141   C283.192780,577.958984 279.380463,578.000000 275.000000,578.000000   C275.000000,554.023010 275.000000,530.261475 275.000000,506.000000  z" />
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
