// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    progress: f64,
    status: String,
    downloaded_bytes: u64,
    total_bytes: u64,
}

fn find_executable(dir: &std::path::Path) -> Option<std::path::PathBuf> {
    // 1. Check if Dominokas.exe is directly in the root
    let direct_path = dir.join("Dominokas.exe");
    if direct_path.exists() {
        return Some(direct_path);
    }
    
    // 2. Search recursively in subdirectories
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = find_executable(&path) {
                    return Some(found);
                }
            } else if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().eq_ignore_ascii_case("exe") {
                        let filename = path.file_name().unwrap().to_string_lossy();
                        if filename.to_lowercase().contains("dominokas") || filename.to_lowercase().contains("deadworks") {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }
    None
}

fn create_shortcuts(target_exe: &std::path::Path) -> Result<(), String> {
    use mslnk::ShellLink;

    // 1. Desktop Shortcut
    if let Some(desktop_dir) = directories::UserDirs::new().and_then(|dirs| dirs.desktop_dir().map(|p| p.to_path_buf())) {
        let lnk_path = desktop_dir.join("Dominokas.lnk");
        let sl = ShellLink::new(target_exe).map_err(|e| format!("Falha ao inicializar atalho da Área de Trabalho: {}", e))?;
        sl.create_lnk(&lnk_path).map_err(|e| format!("Falha ao criar atalho na Área de Trabalho: {}", e))?;
    }
    
    // 2. Start Menu Shortcut
    if let Ok(app_data) = std::env::var("APPDATA") {
        let start_menu_programs = std::path::Path::new(&app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        
        if start_menu_programs.exists() {
            let lnk_path = start_menu_programs.join("Dominokas.lnk");
            let sl = ShellLink::new(target_exe).map_err(|e| format!("Falha ao inicializar atalho do Menu Iniciar: {}", e))?;
            sl.create_lnk(&lnk_path).map_err(|e| format!("Falha ao criar atalho no Menu Iniciar: {}", e))?;
        }
    }
    
    Ok(())
}

#[tauri::command]
fn get_default_install_dir() -> Result<String, String> {
    if let Some(base_dirs) = directories::BaseDirs::new() {
        let data_local_dir = base_dirs.data_local_dir();
        let install_path = data_local_dir.join("Dominokas");
        Ok(install_path.to_string_lossy().into_owned())
    } else {
        Err("Não foi possível localizar o diretório AppData/Local do usuário.".to_string())
    }
}

#[tauri::command]
async fn install_launcher(app: tauri::AppHandle, install_dir: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Dominokas-Setup-Agent")
        .build()
        .map_err(|e| format!("Falha ao criar cliente HTTP: {}", e))?;
     
    app.emit("install-progress", ProgressPayload {
        progress: 1.0,
        status: "Buscando última versão no GitHub...".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
    }).ok();

    let res = client.get("https://api.github.com/repos/YoLeatch/Dominokas-Cliente/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar na API do GitHub: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("A API do GitHub retornou o status de erro: {}", res.status()));
    }

    let release_info: serde_json::Value = res.json()
        .await
        .map_err(|e| format!("Falha ao analisar a resposta do GitHub: {}", e))?;

    // Find the zip asset browser_download_url
    let mut zip_url = None;
    if let Some(assets) = release_info.get("assets").and_then(|a| a.as_array()) {
        for asset in assets {
            if let Some(name) = asset.get("name").and_then(|n| n.as_str()) {
                if name.ends_with(".zip") {
                    if let Some(url) = asset.get("browser_download_url").and_then(|u| u.as_str()) {
                        zip_url = Some(url.to_string());
                        break;
                    }
                }
            }
        }
    }

    let zip_url = zip_url.ok_or_else(|| {
        "Nenhum arquivo compactado (.zip) foi encontrado na última release do GitHub. \
        Certifique-se de que a última release contém o arquivo .zip compilado do cliente.".to_string()
    })?;

    app.emit("install-progress", ProgressPayload {
        progress: 5.0,
        status: "Iniciando download...".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
    }).ok();

    let response = client.get(&zip_url)
        .send()
        .await
        .map_err(|e| format!("Falha ao iniciar o download: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
     
    // Create install directory if it doesn't exist
    let install_path = std::path::Path::new(&install_dir);
    std::fs::create_dir_all(install_path)
        .map_err(|e| format!("Falha ao criar diretório de instalação: {}", e))?;

    let zip_path = install_path.join("dominokas_temp.zip");
    let mut file = std::fs::File::create(&zip_path)
        .map_err(|e| format!("Falha ao criar arquivo temporário: {}", e))?;

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Erro no download do chunk: {}", e))?;
        use std::io::Write;
        file.write_all(&chunk)
            .map_err(|e| format!("Falha ao salvar chunk no disco: {}", e))?;
         
        downloaded += chunk.len() as u64;
         
        // Calculate progress from 5% to 75%
        let progress = 5.0 + (downloaded as f64 / total_size.max(1) as f64) * 70.0;
        let percentage_text = if total_size > 0 {
            format!("Baixando arquivos... ({:.1} MB / {:.1} MB)", downloaded as f64 / 1_048_576.0, total_size as f64 / 1_048_576.0)
        } else {
            format!("Baixando arquivos... ({:.1} MB)", downloaded as f64 / 1_048_576.0)
        };

        app.emit("install-progress", ProgressPayload {
            progress,
            status: percentage_text,
            downloaded_bytes: downloaded,
            total_bytes: total_size,
        }).ok();
    }

    // Ensure everything is flushed to disk and file is closed
    drop(file);

    app.emit("install-progress", ProgressPayload {
        progress: 80.0,
        status: "Extraindo arquivos do launcher...".to_string(),
        downloaded_bytes: downloaded,
        total_bytes: total_size,
    }).ok();

    // Perform Zip extraction inside a blocking thread pool task to prevent freezing tokio reactor
    let install_path_clone = install_path.to_path_buf();
    let zip_path_clone = zip_path.clone();
    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let zip_file = std::fs::File::open(&zip_path_clone)
            .map_err(|e| format!("Falha ao abrir o arquivo baixado: {}", e))?;
        
        let mut archive = zip::ZipArchive::new(zip_file)
            .map_err(|e| format!("Falha ao descompactar arquivo: {}", e))?;

        let total_files = archive.len();

        for i in 0..total_files {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Falha ao ler arquivo {} do pacote: {}", i, e))?;
            
            let outpath = match file.enclosed_name() {
                Some(path) => install_path_clone.join(path),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                std::fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Falha ao criar diretório na extração: {}", e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        std::fs::create_dir_all(p)
                            .map_err(|e| format!("Falha ao criar subdiretório: {}", e))?;
                    }
                }
                let mut outfile = std::fs::File::create(&outpath)
                    .map_err(|e| format!("Falha ao extrair arquivo no disco: {}", e))?;
                std::io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Falha ao salvar arquivo extraído: {}", e))?;
            }

            // Progress from 80% to 95%
            let progress = 80.0 + (i as f64 / total_files.max(1) as f64) * 15.0;
            app_clone.emit("install-progress", ProgressPayload {
                progress,
                status: format!("Extraindo arquivos... ({}/{})", i + 1, total_files),
                downloaded_bytes: downloaded,
                total_bytes: total_size,
            }).ok();
        }
        Ok(())
    }).await.map_err(|e| format!("A thread de extração falhou: {}", e))??;

    // Delete temp zip
    std::fs::remove_file(&zip_path).ok();

    app.emit("install-progress", ProgressPayload {
        progress: 96.0,
        status: "Criando atalhos no sistema...".to_string(),
        downloaded_bytes: downloaded,
        total_bytes: total_size,
    }).ok();

    let target_exe = find_executable(install_path)
        .ok_or_else(|| "Instalação concluída, mas o executável do Dominokas (Dominokas.exe) não foi localizado no diretório extraído.".to_string())?;

    create_shortcuts(&target_exe)?;

    app.emit("install-progress", ProgressPayload {
        progress: 100.0,
        status: "Instalação concluída com sucesso!".to_string(),
        downloaded_bytes: downloaded,
        total_bytes: total_size,
    }).ok();

    Ok(())
}

#[tauri::command]
fn launch_app(install_dir: String) -> Result<(), String> {
    let install_path = std::path::Path::new(&install_dir);
    let target_exe = find_executable(install_path)
        .ok_or_else(|| "Executável do Dominokas não encontrado.".to_string())?;
    
    std::process::Command::new(target_exe)
        .spawn()
        .map_err(|e| format!("Falha ao iniciar o launcher: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_default_install_dir,
            install_launcher,
            launch_app,
            minimize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
