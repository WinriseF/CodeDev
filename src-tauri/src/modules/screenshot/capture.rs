use crate::modules::screenshot::ScreenshotState;
use image::ImageFormat; 
use std::io::Cursor;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use xcap::Monitor;
use std::time::Instant;

#[derive(serde::Serialize, Clone)]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub image_bytes: Vec<u8>,
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn capture_screen<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, ScreenshotState>,
) -> Result<(), String> {
    let start = Instant::now();

    // --- 关键修复：所有 Monitor 操作都必须在 spawn_blocking 内部 ---
    let payload = tauri::async_runtime::spawn_blocking(move || {
        let capture_start = Instant::now();
        
        // 1. 在后台线程获取屏幕列表
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        if monitors.is_empty() { return Err("No monitors found".to_string()); }
        let monitor = monitors.first().unwrap();
        
        // 2. 获取属性
        let width = monitor.width().map_err(|e| e.to_string())?;
        let height = monitor.height().map_err(|e| e.to_string())?;
        let scale_factor = monitor.scale_factor().map_err(|e| e.to_string())?;

        // 3. 截屏 (获取 RGBA 原始数据)
        let image_rgba = monitor.capture_image().map_err(|e| e.to_string())?;
        
        // 4. 直接存为 BMP (极速编码，支持透明通道，无需颜色转换)
        let mut bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        
        image_rgba
            .write_to(&mut cursor, ImageFormat::Bmp)
            .map_err(|e| e.to_string())?;

        println!("Capture & BMP Encode took: {:?}", capture_start.elapsed());

        Ok::<CaptureResult, String>(CaptureResult {
            width,
            height,
            image_bytes: bytes,
            scale_factor: scale_factor as f64,
        })
    }).await.map_err(|e| e.to_string())??;

    // 5. 存入内存
    {
        let mut current_image = state.current_image.lock().unwrap();
        *current_image = Some(payload.image_bytes.clone());
    }

    // 6. 推送数据
    if let Some(window) = app.get_webview_window("screenshot") {
        window.emit("capture-taken", payload).map_err(|e| e.to_string())?;
        
        let _ = window.set_fullscreen(true);
        let _ = window.set_always_on_top(true);
    }

    println!("Total command time: {:?}", start.elapsed());

    Ok(())
}

#[tauri::command]
pub async fn get_current_screenshot(
    state: tauri::State<'_, ScreenshotState>,
) -> Result<CaptureResult, String> {
    let current_image = state.current_image.lock().unwrap();
    if let Some(bytes) = &*current_image {
        let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
        Ok(CaptureResult {
            width: img.width(),
            height: img.height(),
            image_bytes: bytes.clone(),
            scale_factor: 1.0,
        })
    } else {
        Err("No screenshot available".to_string())
    }
}