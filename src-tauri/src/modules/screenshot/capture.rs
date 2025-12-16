use crate::modules::screenshot::ScreenshotState;
use image::ImageFormat;
use std::io::Cursor;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use xcap::Monitor;

#[derive(serde::Serialize, Clone)]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn init_screenshot<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("screenshot") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn capture_screen<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, ScreenshotState>,
) -> Result<(), String> {
    let start = Instant::now();

    let (metadata, buffer) = tauri::async_runtime::spawn_blocking(move || {
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        if monitors.is_empty() {
            return Err("No monitors found".to_string());
        }
        let monitor = monitors.first().unwrap();

        let width = monitor.width().map_err(|e| e.to_string())?;
        let height = monitor.height().map_err(|e| e.to_string())?;
        let scale_factor = monitor.scale_factor().map_err(|e| e.to_string())?;
        
        let image_rgba = monitor.capture_image().map_err(|e| e.to_string())?;

        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        image_rgba
            .write_to(&mut cursor, ImageFormat::Bmp)
            .map_err(|e| e.to_string())?;

        Ok::<_, String>((
            CaptureResult { 
                width, 
                height, 
                scale_factor: scale_factor as f64 
            },
            bytes
        ))
    })
    .await
    .map_err(|e| e.to_string())??;

    {
        let mut current_image = state.current_image.lock().unwrap();
        *current_image = Some(buffer.clone());
    }

    if let Some(window) = app.get_webview_window("screenshot") {
        window.emit("capture-taken", metadata).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_current_screenshot() -> Result<(), String> {
    Ok(())
}