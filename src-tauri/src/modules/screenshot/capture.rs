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
    _app: AppHandle<R>,
    _state: tauri::State<'_, ScreenshotState>,
) -> Result<Vec<u8>, String> { // MODIFIED: Return type is now Vec<u8>
    let start = Instant::now();

    let buffer = tauri::async_runtime::spawn_blocking(move || {
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        if monitors.is_empty() {
            return Err("No monitors found".to_string());
        }
        let monitor = monitors.first().unwrap();

        let image_rgba = monitor.capture_image().map_err(|e| e.to_string())?;

        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);

        // MODIFIED: Encode the image as PNG into the byte vector
        image_rgba
            .write_to(&mut cursor, ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        Ok::<_, String>(bytes) // Return the Vec<u8> containing PNG data
    })
    .await
    .map_err(|e| e.to_string())??;

    println!("[Rust Backend] Capture and PNG encoding took: {:?}", start.elapsed());
    
    // MODIFIED: Directly return the raw bytes
    Ok(buffer)
}

#[tauri::command]
pub async fn get_current_screenshot() -> Result<(), String> {
    Ok(())
}